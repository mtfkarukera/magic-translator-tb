/**
 * Magic Translator — Script d'arrière-plan (Manifest V3)
 * ═══════════════════════════════════════════════════════
 *
 * Point d'entrée de l'extension. S'exécute dans le processus principal
 * de Thunderbird (contexte privilégié).
 *
 * Responsabilités :
 *   1. Enregistrer le script de contenu dans le panneau de lecture (messageDisplay)
 *   2. Recevoir et traiter les requêtes de traduction envoyées par le script injecté
 *   3. Gérer le bouton barre de message (message_display_action) et son menu clic-droit
 *
 * Flux de données :
 *   [bouton barre / menu] → onClicked → tabs.sendMessage({ action: "toggleBanner" })
 *   [translator-injected.js]
 *       → browser.runtime.sendMessage({ action: "translate", text, source, target })
 *       → [background.js] traduireTexte()
 *       → fetch() vers Google Translate API (gtx)
 *       → réponse { success, text, detectedLang }
 *       → [translator-injected.js] met à jour le DOM
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════
// 1. ENREGISTREMENT DU SCRIPT DE CONTENU
// ═══════════════════════════════════════════════════════════════════════════
// messageDisplay.registerScripts injecte automatiquement translator-injected.js
// dans chaque message affiché dans le panneau de lecture natif de Thunderbird.
// L'identifiant "magic-translator-v2" sert de clé unique pour cet enregistrement.
// Si le script est déjà enregistré (ex: rechargement de l'extension), l'erreur
// est interceptée silencieusement.

(async function enregistrerScript() {
  const definition = {
    id: "magic-translator-v2",
    js: ["mt-text.js", "translator-injected.js"]
  };
  // On désenregistre d'abord : garantit que la définition À JOUR (ordre + liste de
  // fichiers) remplace une éventuelle version persistée d'un chargement précédent —
  // sinon, après une mise à jour, mt-text.js ne serait pas injecté.
  try {
    await messenger.scripting.messageDisplay.unregisterScripts({ ids: [definition.id] });
  } catch { /* pas encore enregistré — normal au premier chargement */ }
  try {
    await messenger.scripting.messageDisplay.registerScripts([definition]);
    console.log("[MagicTranslator] Script messageDisplay enregistré.");
  } catch (erreur) {
    console.log("[MagicTranslator] Note registerScripts :", erreur.message || erreur);
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// 2. BOUTON BARRE DE MESSAGE (message_display_action)
// ═══════════════════════════════════════════════════════════════════════════
// Un clic sur le bouton [T] dans la barre de message (aux côtés de Répondre,
// Transférer, etc.) envoie l'action "toggleBanner" au script injecté dans
// l'onglet courant, qui affiche ou masque le bandeau de traduction.

messenger.messageDisplayAction.onClicked.addListener(async (tab) => {
  try {
    await messenger.tabs.sendMessage(tab.id, { action: "toggleBanner" });
  } catch (erreur) {
    // Le script n'est pas encore prêt dans cet onglet (message en cours de chargement).
    console.warn("[MagicTranslator] Impossible d'envoyer toggleBanner :", erreur.message || erreur);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. MENU CLIC DROIT SUR LE BOUTON BARRE
// ═══════════════════════════════════════════════════════════════════════════
// Un clic droit sur le bouton [T] affiche un menu contextuel permettant
// d'activer ou de désactiver le bandeau de traduction.

// Les menus survivent aux rechargements du background : on supprime d'abord
// pour éviter l'erreur « lastError: The menu id already exists ».
messenger.menus.remove("toggle-translator").catch(() => {});
messenger.menus.create({
  id: "toggle-translator",
  title: messenger.i18n.getMessage("toggleTranslatorTitle"),
  contexts: ["message_display_action"]
});

messenger.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "toggle-translator") return;
  try {
    await messenger.tabs.sendMessage(tab.id, { action: "toggleBanner" });
  } catch (erreur) {
    console.warn("[MagicTranslator] Impossible d'envoyer toggleBanner via menu :", erreur.message || erreur);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. RACCOURCI CLAVIER (commands)
// ═══════════════════════════════════════════════════════════════════════════
// Le raccourci (Alt+Shift+T par défaut, remappable dans les paramètres de Thunderbird)
// envoie la même action "toggleBanner" à l'onglet actif. Déclaré dans le manifest sous
// la clé "commands" — visible et reconfigurable par l'utilisateur, et sans collision avec
// « rouvrir l'onglet » (Ctrl+Shift+T).

messenger.commands.onCommand.addListener(async (commande) => {
  if (commande !== "toggle-translator") return;
  try {
    const [onglet] = await messenger.tabs.query({ active: true, currentWindow: true });
    if (onglet) await messenger.tabs.sendMessage(onglet.id, { action: "toggleBanner" });
  } catch (erreur) {
    console.warn("[MagicTranslator] Impossible d'envoyer toggleBanner via raccourci :", erreur.message || erreur);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. GESTIONNAIRE DE MESSAGES (traduction)
// ═══════════════════════════════════════════════════════════════════════════
// Écoute les messages envoyés par le script de contenu via
// browser.runtime.sendMessage(). Seuls les messages avec action "translate"
// sont traités.

messenger.runtime.onMessage.addListener((message, _expediteur) => {
  if (!message || message.action !== "translate") return;

  // Validation du payload : le script injecté est la seule source légitime, mais on ne
  // fait jamais confiance aveuglément à une entrée venant d'un autre contexte.
  if (typeof message.text !== "string" ||
      typeof message.source !== "string" ||
      typeof message.target !== "string") {
    return Promise.resolve({ success: false, error: "INVALID_PAYLOAD" });
  }

  return traduireTexte(message.text, message.source, message.target)
    .catch((erreur) => ({ success: false, error: erreur.message }));
});

/**
 * Envoie une requête POST à l'API Google Translate (client=gtx).
 *
 * @param   {string} texte   — Texte brut à traduire
 * @param   {string} source  — Code langue source ("auto" pour auto-détection)
 * @param   {string} cible   — Code langue cible (ex: "fr", "en")
 * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
 */
async function traduireTexte(texte, source, cible) {
  // ── Construction de l'URL avec les paramètres de requête ──────────────
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    "&sl=" + encodeURIComponent(source) +
    "&tl=" + encodeURIComponent(cible) +
    "&dt=t"; // dt=t → demande les segments de traduction

  // ── Envoi de la requête ───────────────────────────────────────────────
  let reponse;
  try {
    reponse = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "q=" + encodeURIComponent(texte)
    });
  } catch (erreur) {
    // Délai dépassé (AbortSignal.timeout) ou échec réseau : on renvoie des codes
    // d'erreur explicites, traduits côté UI en messages clairs et localisés.
    if (erreur && (erreur.name === "TimeoutError" || erreur.name === "AbortError")) {
      throw new Error("TIMEOUT");
    }
    throw new Error("NETWORK");
  }

  if (!reponse.ok) {
    if (reponse.status === 429) throw new Error("RATE_LIMITED");
    if (reponse.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
    throw new Error("Google Translate HTTP " + reponse.status);
  }

  // ── Analyse de la réponse ─────────────────────────────────────────────
  // Format Google : [[["texte traduit","texte original",...], ...], null, "code_langue"]
  // Google peut aussi renvoyer du HTML (blocage / captcha) avec un HTTP 200 : .json()
  // lèverait alors une SyntaxError, qu'on transforme en erreur de service claire.
  let donnees;
  try {
    donnees = await reponse.json();
  } catch {
    throw new Error("SERVICE_UNAVAILABLE");
  }

  if (donnees && donnees[0] && Array.isArray(donnees[0])) {
    const traduction = donnees[0]
      .filter((segment) => segment && segment[0])
      .map((segment) => segment[0])
      .join("");

    return {
      success: true,
      text: traduction,
      detectedLang: donnees[2] || null
    };
  }

  throw new Error("SERVICE_UNAVAILABLE");
}
