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
// 1. CYCLE DE VIE EVENT PAGE MV3 (SCRIPTS, MENUS & PURGE DES CLÉS ORPHELINES)
// ═══════════════════════════════════════════════════════════════════════════
// En Manifest V3 Thunderbird, l'Event Page s'endort après ~30s d'inactivité et
// ré-exécute le top-level à chaque réveil. Les opérations lourdes ou destructrices
// (unregisterScripts/registerScripts, recréation des menus, purge des clés de
// rédaction) sont donc rattachées aux événements de cycle de vie (onInstalled /
// onStartup), avec un filet de sécurité léger et non destructif au réveil.

const DEFINITION_SCRIPT_MESSAGE = {
  id: "magic-translator-v2",
  js: ["mt-text.js", "translator-injected.js"],
  runAt: "document_idle"
};

const memoireSessionData = new Map();
const memoireSessionFallback = {
  async get(cles) {
    const resultat = {};
    if (cles === null || cles === undefined) {
      memoireSessionData.forEach((v, k) => { resultat[k] = v; });
      return resultat;
    }
    const liste = Array.isArray(cles) ? cles : (typeof cles === "string" ? [cles] : Object.keys(cles));
    for (const k of liste) {
      if (memoireSessionData.has(k)) {
        resultat[k] = memoireSessionData.get(k);
      } else if (cles && !Array.isArray(cles) && typeof cles === "object" && k in cles) {
        resultat[k] = cles[k];
      }
    }
    return resultat;
  },
  async set(obj) {
    if (obj && typeof obj === "object") {
      Object.entries(obj).forEach(([k, v]) => memoireSessionData.set(k, v));
    }
  },
  async remove(cles) {
    const liste = Array.isArray(cles) ? cles : [cles];
    for (const k of liste) {
      memoireSessionData.delete(k);
    }
  }
};

/**
 * Retourne exclusivement le stockage volatil en RAM (storage.session),
 * avec repli mémoire de processus sans jamais écrire de brouillon sur disque.
 */
function obtenirStockageSession() {
  return (browser.storage && browser.storage.session) ? browser.storage.session : memoireSessionFallback;
}

let verrouScripts = Promise.resolve();

/**
 * Enregistre ou met à jour la définition des scripts injectés dans messageDisplay,
 * de manière strictement sérialisée entre réveil d'Event Page, onStartup et onInstalled.
 * @param {boolean} [forcerReenregistrement=false]
 */
function assurerScriptsEnregistres(forcerReenregistrement = false) {
  const executer = async () => {
    try {
      if (!forcerReenregistrement && browser.scripting.messageDisplay.getRegisteredScripts) {
        const deja = await browser.scripting.messageDisplay.getRegisteredScripts({
          ids: [DEFINITION_SCRIPT_MESSAGE.id]
        });
        if (Array.isArray(deja) && deja.length > 0) {
          return;
        }
      }
    } catch { /* repli sur réenregistrement complet */ }

    try {
      await browser.scripting.messageDisplay.unregisterScripts({ ids: [DEFINITION_SCRIPT_MESSAGE.id] });
    } catch { /* pas encore enregistré — normal au premier chargement */ }

    try {
      await browser.scripting.messageDisplay.registerScripts([DEFINITION_SCRIPT_MESSAGE]);
      console.log("[MagicTranslator] Script messageDisplay enregistré.");
    } catch (erreur) {
      console.log("[MagicTranslator] Note registerScripts :", erreur.message || erreur);
    }
  };

  verrouScripts = verrouScripts.then(executer, executer);
  return verrouScripts;
}

/**
 * Recrée proprement et séquentiellement les entrées de menu contextuel.
 */
async function initialiserMenusContextuels() {
  const ids = ["toggle-translator", "open-options", "open-options-compose"];
  for (const id of ids) {
    try {
      await browser.menus.remove(id);
    } catch { /* absent */ }
  }

  try {
    browser.menus.create({
      id: "toggle-translator",
      title: browser.i18n.getMessage("toggleTranslatorTitle"),
      contexts: ["message_display_action"]
    });
    browser.menus.create({
      id: "open-options",
      title: browser.i18n.getMessage("menuOptionsTitle") || "Options",
      contexts: ["message_display_action"]
    });
    browser.menus.create({
      id: "open-options-compose",
      title: browser.i18n.getMessage("menuOptionsTitle") || "Options",
      contexts: ["compose_action"]
    });
  } catch (err) {
    console.warn("[MagicTranslator] Note menus.create :", err.message || err);
  }
}

/**
 * Purge uniquement les clés temporaires `compose_orig_<tabId>` dont l'onglet
 * de rédaction correspondant n'existe plus (et nettoie d'éventuelles traces héritées sur disque).
 */
async function purgerClesRedactionOrphelines() {
  try {
    const ongletsOuverts = await browser.tabs.query({});
    const idsOuverts = new Set(ongletsOuverts.map((t) => `compose_orig_${t.id}`));

    const zoneSession = obtenirStockageSession();
    if (zoneSession && typeof zoneSession.get === "function") {
      const toutSession = await zoneSession.get(null);
      const orphelines = Object.keys(toutSession).filter(
        (k) => k.startsWith("compose_orig_") && !idsOuverts.has(k)
      );
      if (orphelines.length > 0) {
        await zoneSession.remove(orphelines);
      }
    }

    if (browser.storage && browser.storage.local) {
      const toutLocal = await browser.storage.local.get(null);
      const tracesDisque = Object.keys(toutLocal).filter((k) => k.startsWith("compose_orig_"));
      if (tracesDisque.length > 0) {
        await browser.storage.local.remove(tracesDisque);
      }
    }
  } catch { /* ignorer */ }
}

/**
 * Ouvre l'assistant de premier lancement ou active l'onglet existant s'il est déjà ouvert.
 */
async function ouvrirOuActiverSetup() {
  const urlSetup = browser.runtime.getURL("setup/setup.html");
  try {
    const onglets = await browser.tabs.query({});
    const existant = onglets.find((t) => t.url && t.url.startsWith(urlSetup));
    if (existant && existant.id !== undefined) {
      await browser.tabs.update(existant.id, { active: true });
      if (existant.windowId !== undefined && browser.windows && browser.windows.update) {
        await browser.windows.update(existant.windowId, { focused: true }).catch(() => {});
      }
      return;
    }
  } catch { /* repli sur création simple */ }
  await browser.tabs.create({ url: urlSetup });
}

// Filet léger au réveil de l'Event Page : vérifie que le script est bien enregistré sans rien purger
assurerScriptsEnregistres(false).catch(() => {});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ENVOI DU MESSAGE "toggleBanner" AVEC SECOURS INJECTION DYNAMIQUE
// ═══════════════════════════════════════════════════════════════════════════

const togglesEnVol = new Map();

/**
 * Vérifie strictement qu'un onglet est un panneau de lecture de message valide
 * (`mail` ou `messageDisplay` avec au moins un e-mail affiché) afin de ne jamais
 * injecter `translator-injected.js` dans une fenêtre de rédaction (`messageCompose`).
 *
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function estOngletLectureValide(tabId) {
  if (typeof tabId !== "number") return false;
  try {
    const onglet = await browser.tabs.get(tabId);
    if (!onglet || (onglet.type !== "mail" && onglet.type !== "messageDisplay")) {
      return false;
    }
    if (browser.messageDisplay && browser.messageDisplay.getDisplayedMessages) {
      const liste = await browser.messageDisplay.getDisplayedMessages(tabId);
      if (!liste || !Array.isArray(liste.messages) || liste.messages.length === 0) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Envoie l'action "toggleBanner" au script injecté dans l'onglet spécifié (dédupliqué).
 * Si le script de contenu n'est pas présent ou ne répond pas (contexte invalidé,
 * déchargement d'onglet...), il est injecté manuellement de secours avant l'envoi.
 *
 * @param {number} tabId — Identifiant de l'onglet Thunderbird
 */
function envoyerToggleBanner(tabId) {
  if (togglesEnVol.has(tabId)) {
    return togglesEnVol.get(tabId);
  }

  const promesse = (async () => {
    if (!(await estOngletLectureValide(tabId))) {
      return;
    }

    const config = await chargerConfiguration();
    const payload = {
      action: "toggleBanner",
      autoTranslate: Boolean(config.autoTranslateOnClick),
      alternateTarget: config.alternateTarget || "none"
    };
    try {
      await browser.tabs.sendMessage(tabId, payload);
    } catch {
      console.log("[MagicTranslator] Le script de contenu ne répond pas. Injection manuelle de secours...");
      try {
        await browser.scripting.executeScript({
          target: { tabId: tabId },
          files: ["mt-text.js", "translator-injected.js"]
        });
        // Petit délai pour laisser le temps au script de s'initialiser et de s'enregistrer
        await new Promise((resolve) => setTimeout(resolve, 60));
        await browser.tabs.sendMessage(tabId, payload);
      } catch (errSecours) {
        console.error("[MagicTranslator] Échec de l'injection ou de l'envoi de secours :", errSecours.message || errSecours);
      }
    }
  })().finally(() => {
    togglesEnVol.delete(tabId);
  });

  togglesEnVol.set(tabId, promesse);
  return promesse;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. BOUTON BARRE DE MESSAGE (message_display_action)
// ═══════════════════════════════════════════════════════════════════════════

browser.messageDisplayAction.onClicked.addListener((tab) => {
  envoyerToggleBanner(tab.id).catch(console.error);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ÉCOUTEUR DU MENU CLIC DROIT SUR LE BOUTON BARRE
// ═══════════════════════════════════════════════════════════════════════════

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggle-translator") {
    envoyerToggleBanner(tab.id).catch(console.error);
  } else if (info.menuItemId === "open-options" || info.menuItemId === "open-options-compose") {
    browser.runtime.openOptionsPage().catch(console.error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RACCOURCI CLAVIER (commands) & FERMETURE D'ONGLET
// ═══════════════════════════════════════════════════════════════════════════

browser.commands.onCommand.addListener(async (commande) => {
  if (commande !== "toggle-translator") return;
  try {
    const [onglet] = await browser.tabs.query({ active: true, currentWindow: true });
    if (onglet && (await estOngletLectureValide(onglet.id))) {
      await envoyerToggleBanner(onglet.id);
    }
  } catch (erreur) {
    console.error("[MagicTranslator] Raccourci clavier en erreur :", erreur);
  }
});

// Nettoyage automatique du coffre-fort de rédaction lors de la fermeture d'un onglet/fenêtre
browser.tabs.onRemoved.addListener((tabId) => {
  const cle = `compose_orig_${tabId}`;
  obtenirStockageSession().remove(cle).catch(() => {});
  browser.storage.local.remove(cle).catch(() => {});
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. GESTION DE LA CONFIGURATION (storage) & PREMIER LANCEMENT (OPT-IN)
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG_DEFAUT = {
  provider: "none",
  enableMyMemoryFallback: false,
  onboardingShown: false,
  mymemoryEmail: "",
  deeplApiKey: "",
  deeplPlan: "auto",
  libretranslateUrl: "https://libretranslate.com",
  libretranslateApiKey: "",
  geminiApiKey: "",
  geminiModel: "gemini-3.5-flash-lite",
  llmPreset: "openai",
  llmBaseUrl: "https://api.openai.com",
  llmApiKey: "",
  llmModel: "gpt-4o-mini",
  autoTranslateOnClick: false,
  alternateTarget: "none",
  preferLocalDetection: false,
  autoTranslateOnOpen: false,
  autoTranslateMode: "all_foreign",
  autoTranslateLangs: []
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

/**
 * Vérifie si la configuration du moteur choisi possède les identifiants minimums requis.
 * @param {typeof CONFIG_DEFAUT} config
 * @returns {boolean}
 */
function verifierMoteurConfigure(config) {
  if (!config || !config.provider || config.provider === "none") {
    return false;
  }
  const f = globalThis.MTProviders.obtenirFournisseur(config.provider, config);
  if (!f || f.id === "none") {
    return false;
  }
  if (config.provider === "deepl") {
    return Boolean(config.deeplApiKey && config.deeplApiKey.trim());
  }
  if (config.provider === "gemini") {
    return Boolean(config.geminiApiKey && config.geminiApiKey.trim());
  }
  if (config.provider === "llm") {
    const preset = config.llmPreset || "openai";
    if (preset === "openai" || preset === "groq" || preset === "mistral") {
      return Boolean(config.llmApiKey && config.llmApiKey.trim());
    }
    if (preset === "custom") {
      return Boolean(config.llmBaseUrl && config.llmBaseUrl.trim());
    }
    return true;
  }
  return true;
}

// Initialisation au démarrage de Thunderbird
browser.runtime.onStartup.addListener(async () => {
  await assurerScriptsEnregistres(true);
  await initialiserMenusContextuels();
  await purgerClesRedactionOrphelines();
});

// Initialisation et ouverture automatique de l'assistant au premier lancement (Opt-In explicite ATN)
browser.runtime.onInstalled.addListener(async (details) => {
  await assurerScriptsEnregistres(true);
  await initialiserMenusContextuels();
  await purgerClesRedactionOrphelines();

  try {
    if (details.reason === "install") {
      await ouvrirOuActiverSetup();
    } else if (details.reason === "update") {
      const stocke = await browser.storage.local.get(["provider", "onboardingShown"]);
      if ((!stocke.provider || stocke.provider === "none") && !stocke.onboardingShown) {
        await ouvrirOuActiverSetup();
      }
    }
  } catch (err) {
    console.warn("[MagicTranslator] Impossible d'ouvrir l'assistant de premier lancement :", err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. GESTIONNAIRE DE MESSAGES (traduction & configuration)
// ═══════════════════════════════════════════════════════════════════════════

const CODE_LANGUE_RE = /^(auto|[a-z]{2,3}(-[a-zA-Z]{2,4})?)$/i;
// Codes d'erreur attendus du background — tout autre message brut est normalisé.
// [Mi-S1] On n'expose jamais d'erreur JavaScript interne à l'UI.
const CODES_ERREURS_CONNUS = new Set([
  "TIMEOUT",
  "NETWORK",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INVALID_PAYLOAD",
  "UNAUTHORIZED",
  "PERMISSION_REQUIRED",
  "CONSENT_REQUIRED",
  "CLEARTEXT_FORBIDDEN"
]);

/**
 * Détecte la langue d'un texte en local via le moteur C++ CLD2 intégré à Thunderbird.
 * 100% hors-ligne, zéro appel réseau, zéro permission additionnelle.
 * @param {string} texte
 * @returns {Promise<{lang: string|null, isReliable: boolean, percentage: number, languages: Array<{lang: string, percentage: number}>}>}
 */
async function detecterLangueLocale(texte) {
  if (!texte || typeof texte !== "string") {
    return { lang: null, isReliable: false, percentage: 0, languages: [] };
  }
  const texteEpure = texte.replace(/\bMTSEP[0-9a-f]+\b/gi, " ").trim();
  if (!texteEpure) {
    return { lang: null, isReliable: false, percentage: 0, languages: [] };
  }
  try {
    if (browser.i18n && browser.i18n.detectLanguage) {
      const res = await browser.i18n.detectLanguage(texteEpure.slice(0, 1500));
      if (res && Array.isArray(res.languages) && res.languages.length > 0) {
        const premier = res.languages[0];
        const code = (premier.language || "").split("-")[0].toLowerCase();
        const toutes = res.languages.map((l) => ({
          lang: (l.language || "").split("-")[0].toLowerCase(),
          percentage: l.percentage || 0
        }));
        return {
          lang: code || null,
          isReliable: Boolean(res.isReliable),
          percentage: premier.percentage || 0,
          languages: toutes
        };
      }
    }
  } catch (err) {
    console.warn("[MagicTranslator] Échec detectLanguage local :", err);
  }
  return { lang: null, isReliable: false, percentage: 0, languages: [] };
}

/**
 * Vérifie l'équivalence linguistique par code primaire (ex: "fr" et "fr-FR").
 * @param {string|null} l1
 * @param {string|null} l2
 * @returns {boolean}
 */
function languesEquivalentes(l1, l2) {
  if (!l1 || !l2) return false;
  const n1 = l1.toLowerCase();
  const n2 = l2.toLowerCase();
  return n1 === n2 || n1.split("-")[0] === n2.split("-")[0];
}

/**
 * Traite les requêtes de messages internes de façon asynchrone.
 * @param {Object} message
 * @param {Object} expediteur
 * @returns {Promise<Object>}
 */
async function traiterMessage(message, expediteur) {
  if (!message) return { success: false, error: "INVALID_PAYLOAD" };

  // [M-S1] Validation de l'expéditeur : seul notre propre script ou page d'options est autorisé.
  if (!expediteur || expediteur.id !== browser.runtime.id) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  // Maintien en éveil MV3 inter-contextes pendant les appels potentiellement longs
  if (message.action === "ping") {
    return { success: true, pong: true };
  }

  const urlOptions = browser.runtime.getURL("options/options.html");
  const vientDesOptions = Boolean(expediteur.url && expediteur.url.startsWith(urlOptions));

  // ── Action 1 : Demande de configuration active (avec vérification permission & complétude) ──
  if (message.action === "getConfig") {
    const config = await chargerConfiguration();
    const fournisseur = globalThis.MTProviders.obtenirFournisseur(config.provider, config);
    const consentRequired = !config.provider || config.provider === "none" || fournisseur.id === "none";
    const isConfigured = !consentRequired && verifierMoteurConfigure(config);
    const requiredOrigin = globalThis.MTProviders.obtenirPatternOrigine(config.provider, config);
    let hasPermission = !consentRequired && Boolean(requiredOrigin);
    if (!consentRequired && requiredOrigin) {
      try {
        if (browser.permissions && browser.permissions.contains) {
          hasPermission = await browser.permissions.contains({ origins: [requiredOrigin] });
        }
      } catch {
        hasPermission = false;
      }
    }
    return {
      success: true,
      provider: consentRequired ? "none" : config.provider,
      providerLabel: fournisseur.label,
      providerNom: fournisseur.nomComplet,
      consentRequired,
      isConfigured,
      enableMyMemoryFallback: Boolean(config.enableMyMemoryFallback),
      hasPermission: Boolean(hasPermission),
      requiredOrigin,
      autoTranslateOnClick: Boolean(config.autoTranslateOnClick),
      alternateTarget: config.alternateTarget || "none",
      preferLocalDetection: Boolean(config.preferLocalDetection),
      autoTranslateOnOpen: Boolean(config.autoTranslateOnOpen),
      autoTranslateMode: config.autoTranslateMode || "all_foreign",
      autoTranslateLangs: Array.isArray(config.autoTranslateLangs) ? config.autoTranslateLangs : [],
      uiLanguage: (browser.i18n && browser.i18n.getUILanguage) ? browser.i18n.getUILanguage() : "fr"
    };
  }

  // ── Action 1b : Opt-In rapide 1-clic (Google Translate + MyMemory optionnel) ──
  if (message.action === "acceptDefaultProvider") {
    const actuel = await chargerConfiguration();
    // Ne jamais écraser silencieusement un autre moteur déjà choisi et enregistré
    if (actuel.provider && actuel.provider !== "none" && actuel.provider !== "google") {
      const fActif = globalThis.MTProviders.obtenirFournisseur(actuel.provider, actuel);
      const origActif = globalThis.MTProviders.obtenirPatternOrigine(actuel.provider, actuel);
      let permActif = Boolean(origActif);
      if (origActif && browser.permissions && browser.permissions.contains) {
        permActif = await browser.permissions.contains({ origins: [origActif] }).catch(() => false);
      }
      return {
        success: true,
        provider: actuel.provider,
        providerLabel: fActif.label,
        providerNom: fActif.nomComplet,
        isConfigured: verifierMoteurConfigure(actuel),
        hasPermission: Boolean(permActif),
        enableMyMemoryFallback: Boolean(actuel.enableMyMemoryFallback)
      };
    }

    const enableFallback = Boolean(message.enableMyMemoryFallback);
    await browser.storage.local.set({
      provider: "google",
      enableMyMemoryFallback: enableFallback,
      onboardingShown: true
    });
    let hasPermGoogle = true;
    try {
      if (browser.permissions && browser.permissions.contains) {
        hasPermGoogle = await browser.permissions.contains({ origins: ["https://translate-pa.googleapis.com/*"] });
      }
    } catch {
      hasPermGoogle = false;
    }
    return {
      success: true,
      provider: "google",
      providerLabel: "Google",
      providerNom: "Google Translate",
      isConfigured: true,
      hasPermission: Boolean(hasPermGoogle),
      enableMyMemoryFallback: enableFallback
    };
  }

  // ── Action 1c : Ouverture de l'assistant de premier lancement (setup dédupliqué) ──
  if (message.action === "openSetup") {
    try {
      await ouvrirOuActiverSetup();
      return { success: true };
    } catch {
      return { success: false, error: "SERVICE_UNAVAILABLE" };
    }
  }

  // ── Action 2 : Test direct de connexion fournisseur (strictement réservé aux Options) ──
  if (message.action === "testProvider") {
    if (!vientDesOptions) {
      return { success: false, error: "UNAUTHORIZED", message: "UNAUTHORIZED" };
    }
    const cfgTest = message.config || {};
    const origineTest = globalThis.MTProviders.obtenirPatternOrigine(cfgTest.provider, cfgTest);
    if (!origineTest) {
      return { success: false, message: (!cfgTest.provider || cfgTest.provider === "none") ? "CONSENT_REQUIRED" : "INVALID_PAYLOAD" };
    }
    try {
      if (browser.permissions && browser.permissions.contains) {
        const permOk = await browser.permissions.contains({ origins: [origineTest] });
        if (!permOk) {
          return { success: false, message: "PERMISSION_REQUIRED" };
        }
      }
    } catch {
      return { success: false, message: "PERMISSION_REQUIRED" };
    }
    const resTest = await globalThis.MTProviders.testerConnexion(cfgTest);
    if (resTest && !resTest.success && !CODES_ERREURS_CONNUS.has(resTest.message)) {
      return { success: false, message: "SERVICE_UNAVAILABLE" };
    }
    return resTest;
  }

  // ── Action 2b : Liste dynamique des modèles Google Gemini (strictement réservé aux Options) ──
  if (message.action === "listGeminiModels") {
    if (!vientDesOptions) {
      return { success: false, error: "UNAUTHORIZED", message: "UNAUTHORIZED" };
    }
    try {
      if (browser.permissions && browser.permissions.contains) {
        const permGemini = await browser.permissions.contains({ origins: ["https://generativelanguage.googleapis.com/*"] });
        if (!permGemini) {
          return { success: false, error: "PERMISSION_REQUIRED", message: "PERMISSION_REQUIRED" };
        }
      }
    } catch {
      return { success: false, error: "PERMISSION_REQUIRED", message: "PERMISSION_REQUIRED" };
    }
    try {
      const models = await globalThis.MTProviders.listerModelesGemini(message.apiKey);
      return { success: true, models };
    } catch (err) {
      const code = (err && CODES_ERREURS_CONNUS.has(err.message)) ? err.message : "SERVICE_UNAVAILABLE";
      return { success: false, error: code, message: code };
    }
  }

  // ── Action 2c : Ouverture directe de la page des options ──────────────────
  if (message.action === "openOptions") {
    try {
      await browser.runtime.openOptionsPage();
      return { success: true };
    } catch {
      return { success: false, error: "SERVICE_UNAVAILABLE" };
    }
  }

  // ── Action 2d : Détection locale de la langue (CLD2 hors-ligne) ───────────
  if (message.action === "detectLanguage") {
    const res = await detecterLangueLocale(message.text || "");
    return { success: true, ...res };
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
    const fournisseur = globalThis.MTProviders.obtenirFournisseur(config.provider, config);

    // Garde-fou strict Opt-In ATN : aucun appel réseau sans consentement explicite
    if (!config.provider || config.provider === "none" || fournisseur.id === "none") {
      return {
        success: false,
        error: "CONSENT_REQUIRED"
      };
    }

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

    // Vérification préventive des permissions réseau (fail-closed)
    const requiredOrigin = globalThis.MTProviders.obtenirPatternOrigine(config.provider, configProvider);
    if (!requiredOrigin) {
      // Vérifie s'il s'agit d'un rejet HTTP non-loopback pour remonter CLEARTEXT_FORBIDDEN
      const urlCandidate = (url || "").trim();
      if (urlCandidate) {
        const checkUrl = globalThis.MTProviders.validerUrlSecurisee(urlCandidate);
        if (!checkUrl.valide && checkUrl.erreur === "CLEARTEXT_FORBIDDEN") {
          return { success: false, error: "CLEARTEXT_FORBIDDEN" };
        }
      }
      return { success: false, error: "INVALID_PAYLOAD" };
    }

    try {
      if (browser.permissions && browser.permissions.contains) {
        const hasPerm = await browser.permissions.contains({ origins: [requiredOrigin] });
        if (!hasPerm) {
          return {
            success: false,
            error: "PERMISSION_REQUIRED",
            requiredOrigin
          };
        }
        // Vérifier également l'accès hôte MyMemory avant d'autoriser le relais de secours
        if (config.provider === "google" && configProvider.enableMyMemoryFallback) {
          const permMyMemory = await browser.permissions.contains({
            origins: ["https://api.mymemory.translated.net/*"]
          }).catch(() => false);
          if (!permMyMemory) {
            configProvider.enableMyMemoryFallback = false;
          }
        }
      }
    } catch {
      return {
        success: false,
        error: "PERMISSION_REQUIRED",
        requiredOrigin
      };
    }

    // Détection locale préalable hors-ligne (CLD2) pour orienter LibreTranslate/LLMs
    // ou court-circuiter si le texte est déjà dans la langue cible (préserve alternateTarget)
    let langueLocaleDetectee = null;
    const detLocale = await detecterLangueLocale(message.text);
    if (detLocale && detLocale.lang && detLocale.isReliable) {
      langueLocaleDetectee = detLocale.lang;
    }

    let sourceEffective = message.source;
    if (config.preferLocalDetection && message.source === "auto" && langueLocaleDetectee) {
      if (languesEquivalentes(langueLocaleDetectee, message.target)) {
        return {
          success: true,
          text: message.text,
          detectedLang: langueLocaleDetectee,
          provider: config.provider,
          configuredProvider: config.provider,
          usedFallback: false,
          providerLabel: fournisseur.label,
          providerNom: fournisseur.nomComplet
        };
      }
      sourceEffective = langueLocaleDetectee;
    }

    // Maintien en éveil de l'Event Page MV3 pendant les requêtes locales longues (jusqu'à 60s)
    const keepAliveTimer = setInterval(() => {
      if (browser.runtime && browser.runtime.getPlatformInfo) {
        browser.runtime.getPlatformInfo().catch(() => {});
      }
    }, 20000);

    try {
      let res;
      try {
        res = await globalThis.MTProviders.traduire(configProvider, message.text, sourceEffective, message.target);
      } catch (errMoteur) {
        // Secours pour LibreTranslate si source: "auto" n'est pas supporté par le serveur
        if (config.provider === "libretranslate" && sourceEffective === "auto" && langueLocaleDetectee) {
          console.log("[MagicTranslator] Secours LibreTranslate : relance avec langue locale", langueLocaleDetectee);
          res = await globalThis.MTProviders.traduire(configProvider, message.text, langueLocaleDetectee, message.target);
        } else {
          throw errMoteur;
        }
      }

      const detectedLangFinal = res.detectedLang || langueLocaleDetectee || null;
      const providerFinal = res.effectiveProvider || config.provider;
      const labelFinal = res.effectiveLabel || fournisseur.label;
      const nomFinal = res.effectiveNom || fournisseur.nomComplet;

      return {
        success: true,
        text: res.text,
        detectedLang: detectedLangFinal,
        provider: providerFinal,
        configuredProvider: config.provider,
        usedFallback: Boolean(res.effectiveProvider && res.effectiveProvider !== config.provider),
        providerLabel: labelFinal,
        providerNom: nomFinal
      };
    } catch (erreur) {
      return {
        success: false,
        error: CODES_ERREURS_CONNUS.has(erreur.message) ? erreur.message : "SERVICE_UNAVAILABLE"
      };
    } finally {
      clearInterval(keepAliveTimer);
    }
  }

  return { success: false, error: "UNKNOWN_ACTION" };
}

// Écouteur synchrone officiel pour WebExtensions Thunderbird MV3 :
// La fonction listener n'est pas async, retourne true pour maintenir le canal ouvert,
// et répond via sendResponse() une fois la promesse résolue.
browser.runtime.onMessage.addListener((message, expediteur, sendResponse) => {
  traiterMessage(message, expediteur)
    .then((reponse) => {
      sendResponse(reponse);
    })
    .catch((err) => {
      const code = (err && CODES_ERREURS_CONNUS.has(err.message)) ? err.message : "SERVICE_UNAVAILABLE";
      sendResponse({ success: false, error: code });
    });
  return true;
});
