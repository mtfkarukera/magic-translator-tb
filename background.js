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

  // ── Purge proactive des clés temporaires de session de rédaction orphelines ──
  try {
    const tout = await browser.storage.local.get(null);
    const clefsASupprimer = Object.keys(tout).filter((k) => k.startsWith("compose_orig_"));
    if (clefsASupprimer.length > 0) {
      await browser.storage.local.remove(clefsASupprimer);
    }
  } catch { /* ignorer */ }
})();

// ═══════════════════════════════════════════════════════════════════════════
// 2. ENVOI DU MESSAGE "toggleBanner" AVEC SECOURS INJECTION DYNAMIQUE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Envoie l'action "toggleBanner" au script injecté dans l'onglet spécifié.
 * Si le script de contenu n'est pas présent ou ne répond pas (contexte invalidé,
 * déchargement d'onglet...), il est injecté manuellement de secours avant l'envoi.
 *
 * @param {number} tabId — Identifiant de l'onglet Thunderbird
 */
async function envoyerToggleBanner(tabId) {
  try {
    await messenger.tabs.sendMessage(tabId, { action: "toggleBanner" });
  } catch {
    console.log("[MagicTranslator] Le script de contenu ne répond pas. Injection manuelle de secours...");
    try {
      await messenger.scripting.executeScript({
        target: { tabId: tabId },
        files: ["mt-text.js", "translator-injected.js"]
      });
      // Petit délai pour laisser le temps au script de s'initialiser et de s'enregistrer
      await new Promise((resolve) => setTimeout(resolve, 60));
      await messenger.tabs.sendMessage(tabId, { action: "toggleBanner" });
    } catch (errSecours) {
      console.error("[MagicTranslator] Échec de l'injection ou de l'envoi de secours :", errSecours.message || errSecours);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. BOUTON BARRE DE MESSAGE (message_display_action)
// ═══════════════════════════════════════════════════════════════════════════
// Un clic sur le bouton [T] dans la barre de message (aux côtés de Répondre,
// Transférer, etc.) envoie l'action "toggleBanner" au script injecté dans
// l'onglet courant, qui affiche ou masque le bandeau de traduction.

messenger.messageDisplayAction.onClicked.addListener((tab) => {
  envoyerToggleBanner(tab.id).catch(console.error);
});

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// 4. MENU CLIC DROIT SUR LE BOUTON BARRE
// ═══════════════════════════════════════════════════════════════════════════
// Un clic droit sur le bouton [T] affiche un menu contextuel permettant
// d'activer ou de désactiver le bandeau, ou d'ouvrir les options.

messenger.menus.remove("toggle-translator").catch(() => {});
messenger.menus.remove("open-options").catch(() => {});
messenger.menus.remove("open-options-compose").catch(() => {});

messenger.menus.create({
  id: "toggle-translator",
  title: messenger.i18n.getMessage("toggleTranslatorTitle"),
  contexts: ["message_display_action"]
});

messenger.menus.create({
  id: "open-options",
  title: messenger.i18n.getMessage("menuOptionsTitle") || "Options",
  contexts: ["message_display_action"]
});

messenger.menus.create({
  id: "open-options-compose",
  title: messenger.i18n.getMessage("menuOptionsTitle") || "Options",
  contexts: ["compose_action"]
});

messenger.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggle-translator") {
    envoyerToggleBanner(tab.id).catch(console.error);
  } else if (info.menuItemId === "open-options" || info.menuItemId === "open-options-compose") {
    browser.runtime.openOptionsPage().catch(console.error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RACCOURCI CLAVIER (commands)
// ═══════════════════════════════════════════════════════════════════════════
// Le raccourci (Alt+Shift+T par défaut, remappable dans les paramètres de Thunderbird)
// envoie la même action "toggleBanner" à l'onglet actif. Déclaré dans le manifest sous
// la clé "commands" — visible et reconfigurable par l'utilisateur, et sans collision avec
// « rouvrir l'onglet » (Ctrl+Shift+T).

messenger.commands.onCommand.addListener(async (commande) => {
  if (commande !== "toggle-translator") return;
  try {
    const [onglet] = await messenger.tabs.query({ active: true, currentWindow: true });
    if (onglet) {
      await envoyerToggleBanner(onglet.id);
    }
  } catch (erreur) {
    console.error("[MagicTranslator] Raccourci clavier en erreur :", erreur);
  }
});

// Nettoyage automatique du coffre-fort de rédaction lors de la fermeture d'un onglet/fenêtre
messenger.tabs.onRemoved.addListener((tabId) => {
  browser.storage.local.remove(`compose_orig_${tabId}`).catch(() => {});
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. GESTION DE LA CONFIGURATION (storage)
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG_DEFAUT = {
  provider: "google",
  deeplApiKey: "",
  deeplPlan: "auto",
  libretranslateUrl: "https://libretranslate.com",
  libretranslateApiKey: "",
  geminiApiKey: "",
  geminiModel: "gemini-3.5-flash-lite",
  llmPreset: "openai",
  llmBaseUrl: "https://api.openai.com",
  llmApiKey: "",
  llmModel: "gpt-4o-mini"
};

/**
 * Récupère la configuration persistée dans browser.storage.local.
 * @returns {Promise<typeof CONFIG_DEFAUT>}
 */
async function chargerConfiguration() {
  try {
    const stocke = await browser.storage.local.get(Object.keys(CONFIG_DEFAUT));
    return { ...CONFIG_DEFAUT, ...stocke };
  } catch {
    return { ...CONFIG_DEFAUT };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. GESTIONNAIRE DE MESSAGES (traduction & configuration)
// ═══════════════════════════════════════════════════════════════════════════
// Écoute les messages envoyés par le script de contenu ou la page d'options
// via browser.runtime.sendMessage().

// Format BCP-47 simplifié : "auto", "fr", "en", "zh-CN", "zh-TW", "pt-br", etc.
// [M-S2] Validation des codes de langue pour éviter toute injection de paramètre URL.
const CODE_LANGUE_RE = /^(auto|[a-z]{2,3}(-[a-zA-Z]{2,4})?)$/i;

// Codes d'erreur attendus du background — tout autre message brut est normalisé.
// [Mi-S1] On n'expose jamais d'erreur JavaScript interne à l'UI.
const CODES_ERREURS_CONNUS = new Set(["TIMEOUT", "NETWORK", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "INVALID_PAYLOAD", "UNAUTHORIZED"]);

/**
 * Traite les requêtes de messages internes de façon asynchrone.
 * @param {Object} message
 * @param {Object} expediteur
 * @returns {Promise<Object>}
 */
async function traiterMessage(message, expediteur) {
  if (!message) return { success: false, error: "INVALID_PAYLOAD" };

  // [M-S1] Validation de l'expéditeur : seul notre propre script ou page d'options est autorisé.
  if (!expediteur || expediteur.id !== messenger.runtime.id) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  // ── Action 1 : Demande de configuration active (pour affichage du badge) ──
  if (message.action === "getConfig") {
    const config = await chargerConfiguration();
    const fournisseur = globalThis.MTProviders.obtenirFournisseur(config.provider, config);
    return {
      success: true,
      provider: config.provider,
      providerLabel: fournisseur.label,
      providerNom: fournisseur.nomComplet
    };
  }

  // ── Action 2 : Test direct de connexion fournisseur (depuis options) ──────
  if (message.action === "testProvider") {
    return await globalThis.MTProviders.testerConnexion(message.config);
  }

  // ── Action 2b : Liste dynamique des modèles Google Gemini ────────────────
  if (message.action === "listGeminiModels") {
    try {
      const models = await globalThis.MTProviders.listerModelesGemini(message.apiKey);
      return { success: true, models };
    } catch (err) {
      return { success: false, message: err.message || "Impossible de récupérer les modèles." };
    }
  }

  // ── Action 3 : Requête de traduction ─────────────────────────────────────
  if (message.action === "translate") {
    // Validation du payload : type strict pour éviter toute injection.
    if (typeof message.text !== "string" ||
        typeof message.source !== "string" ||
        typeof message.target !== "string") {
      return { success: false, error: "INVALID_PAYLOAD" };
    }

    // [M-S2] Validation du format BCP-47 des codes de langue.
    if (!CODE_LANGUE_RE.test(message.source) || !CODE_LANGUE_RE.test(message.target)) {
      return { success: false, error: "INVALID_PAYLOAD" };
    }

    const config = await chargerConfiguration();
    let apiKey = "";
    let url = "";
    let model = "";

    if (config.provider === "deepl") {
      apiKey = config.deeplApiKey;
    } else if (config.provider === "libretranslate") {
      apiKey = config.libretranslateApiKey;
      url = config.libretranslateUrl;
    } else if (config.provider === "gemini") {
      apiKey = config.geminiApiKey;
      model = config.geminiModel;
    } else if (config.provider === "llm") {
      apiKey = config.llmApiKey;
      url = config.llmBaseUrl;
      model = config.llmModel;
    }

    const configProvider = {
      ...config,
      apiKey,
      url,
      model,
      preset: config.llmPreset,
      plan: config.deeplPlan
    };

    try {
      const res = await globalThis.MTProviders.traduire(configProvider, message.text, message.source, message.target);
      const fournisseur = globalThis.MTProviders.obtenirFournisseur(config.provider, config);
      return {
        success: true,
        text: res.text,
        detectedLang: res.detectedLang,
        provider: config.provider,
        providerLabel: fournisseur.label
      };
    } catch (erreur) {
      return {
        success: false,
        error: CODES_ERREURS_CONNUS.has(erreur.message) ? erreur.message : "SERVICE_UNAVAILABLE"
      };
    }
  }

  return { success: false, error: "UNKNOWN_ACTION" };
}

// Écouteur synchrone officiel pour WebExtensions Thunderbird MV3 :
// La fonction listener n'est pas async, retourne true pour maintenir le canal ouvert,
// et répond via sendResponse() une fois la promesse résolue.
messenger.runtime.onMessage.addListener((message, expediteur, sendResponse) => {
  traiterMessage(message, expediteur)
    .then((reponse) => {
      sendResponse(reponse);
    })
    .catch((err) => {
      sendResponse({ success: false, error: err.message || "SERVICE_UNAVAILABLE" });
    });
  return true;
});
