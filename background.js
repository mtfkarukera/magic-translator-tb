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
 *   3. Stocker la locale de l'interface pour que le script injecté puisse la lire
 *   4. Gérer le bouton barre de message (message_display_action) et son menu clic-droit
 *
 * Flux de données :
 *   [bouton barre / menu] → onClicked → tabs.sendMessage({ action: "toggleBanner" })
 *   [translator-injected.js]
 *       → browser.runtime.sendMessage({ action: "translate", text, source, target })
 *       → [background.js] translateText()
 *       → fetch() vers Google Translate API (gtx)
 *       → réponse { success, text, detectedLang }
 *       → [translator-injected.js] met à jour le DOM
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════
// 1. GESTION DE LA LOCALE DE L'INTERFACE
// ═══════════════════════════════════════════════════════════════════════════
// La locale de l'interface Thunderbird est envoyée à la demande au script injecté.

// ═══════════════════════════════════════════════════════════════════════════
// 2. ENREGISTREMENT DU SCRIPT DE CONTENU
// ═══════════════════════════════════════════════════════════════════════════
// messageDisplay.registerScripts injecte automatiquement translator-injected.js
// dans chaque message affiché dans le panneau de lecture natif de Thunderbird.
// L'identifiant "magic-translator-v2" sert de clé unique pour cet enregistrement.
// Si le script est déjà enregistré (ex: rechargement de l'extension), l'erreur
// est interceptée silencieusement.

(async function enregistrerScript() {
  try {
    await messenger.scripting.messageDisplay.registerScripts([{
      id: "magic-translator-v2",
      js: ["translator-injected.js"]
    }]);
    console.log("[MagicTranslator] Script messageDisplay enregistré.");
  } catch (erreur) {
    // Déjà enregistré depuis un chargement précédent — ce n'est pas un problème.
    console.log("[MagicTranslator] Note registerScripts :", erreur.message || erreur);
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// 3. BOUTON BARRE DE MESSAGE (message_display_action)
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
// 4. MENU CLIC DROIT SUR LE BOUTON BARRE
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
// 5. GESTIONNAIRE DE MESSAGES (traduction)
// ═══════════════════════════════════════════════════════════════════════════
// Écoute les messages envoyés par le script de contenu via
// browser.runtime.sendMessage(). Seuls les messages avec action "translate"
// sont traités.

messenger.runtime.onMessage.addListener((message, _expediteur) => {
  remoteLog({ type: "onMessage_received", message });

  if (message.action !== "translate") return;

  remoteLog({ type: "onMessage_translate_start", source: message.source, target: message.target, textLen: message.text.length });

  return traduireTexte(message.text, message.source, message.target)
    .then((res) => {
      remoteLog({ type: "onMessage_translate_success", success: res.success, textLen: res.text ? res.text.length : 0 });
      return res;
    })
    .catch((erreur) => {
      remoteLog({ type: "onMessage_translate_error", error: erreur.message });
      return { success: false, error: erreur.message };
    });
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
  const reponse = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "q=" + encodeURIComponent(texte)
  });

  if (!reponse.ok) {
    throw new Error("Google Translate HTTP " + reponse.status);
  }

  // ── Analyse de la réponse ─────────────────────────────────────────────
  // Format de réponse Google : [[["texte traduit","texte original",...], ...], null, "code_langue"]
  const donnees = await reponse.json();

  if (donnees && donnees[0] && Array.isArray(donnees[0])) {
    const traduction = donnees[0]
      .filter((segment) => segment && segment[0])
      .map((segment) => segment[0])
      .join("");

    remoteLog({ type: "traduireTexte_success", detectedLang: donnees[2] });
    return {
      success: true,
      text: traduction,
      detectedLang: donnees[2] || null
    };
  }

  remoteLog({ type: "traduireTexte_invalid_format", donnees });
  throw new Error("Réponse invalide de Google Translate");
}

// Passer DEBUG à true pour activer les logs de débogage local (serveur sur :9999).
// NE PAS passer à true en production : les données des e-mails seraient transmises.
const DEBUG = false;
function remoteLog(obj) {
  if (!DEBUG) return;
  fetch("http://localhost:9999/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "background", data: obj, timestamp: new Date().toISOString() })
  }).catch(() => {});
}
