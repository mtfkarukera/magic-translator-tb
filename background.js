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
 *   4. Gérer le raccourci clavier Ctrl+Shift+T
 *
 * Flux de données :
 *   [translator-injected.js]
 *       → browser.runtime.sendMessage({ action: "translate", text, source, target })
 *       → [background.js] translateText()
 *       → fetch() vers Google Translate API (gtx)
 *       → réponse { success, text, detectedLang }
 *       → [translator-injected.js] met à jour le DOM
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════
// 1. STOCKAGE DE LA LOCALE UI
// ═══════════════════════════════════════════════════════════════════════════
// Sauvegarde la langue de l'interface Thunderbird (ex: "fr", "en") dans le
// storage local. Le script injecté pourra la lire pour adapter ses textes.

(async function sauvegarderLocale() {
  try {
    const codeLang = messenger.i18n.getUILanguage().split("-")[0];
    await messenger.storage.local.set({ uiLocale: codeLang });
  } catch (erreur) {
    console.warn("[MagicTranslator] Impossible de stocker la locale UI :", erreur);
  }
})();

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
// 3. GESTIONNAIRE DE MESSAGES (traduction)
// ═══════════════════════════════════════════════════════════════════════════
// Écoute les messages envoyés par le script de contenu via
// browser.runtime.sendMessage(). Seuls les messages avec action "translate"
// sont traités.

messenger.runtime.onMessage.addListener((message, _expediteur) => {
  if (message.action !== "translate") return;

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
  const reponse = await fetch(url, {
    method: "POST",
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

    return {
      success: true,
      text: traduction,
      detectedLang: donnees[2] || null
    };
  }

  throw new Error("Réponse invalide de Google Translate");
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. RACCOURCI CLAVIER
// ═══════════════════════════════════════════════════════════════════════════
// Écoute la commande "toggle-translate" définie dans manifest.json
// (Ctrl+Shift+T / MacCtrl+Shift+T). Envoie un CustomEvent au document
// actif pour déclencher la traduction dans le script de contenu.

messenger.commands.onCommand.addListener(async (commande) => {
  if (commande !== "toggle-translate") return;

  try {
    const onglets = await messenger.tabs.query({ active: true, currentWindow: true });
    if (onglets.length === 0) return;

    await messenger.scripting.executeScript({
      target: { tabId: onglets[0].id },
      func: () => {
        document.dispatchEvent(new CustomEvent("magic-translator-shortcut"));
      }
    });
  } catch (erreur) {
    console.warn("[MagicTranslator] Échec du raccourci :", erreur);
  }
});
