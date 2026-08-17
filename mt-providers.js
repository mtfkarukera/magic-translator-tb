/**
 * Magic Translator — Moteurs de Traduction (Providers)
 * ══════════════════════════════════════════════════════
 *
 * Module pur et modulaire encapsulant les différents fournisseurs de traduction.
 * Compatible avec l'environnement Thunderbird WebExtension et Node.js (tests).
 *
 * Fournisseurs supportés :
 *   1. Google Translate (client=gtx, gratuit, sans configuration)
 *   2. DeepL API (Free & Pro, authentification par clé API)
 *   3. LibreTranslate (instance publique ou auto-hébergée / on-premise)
 */

"use strict";

(() => {
  const TIMEOUT_TRADUCTION_MS = 10000; // 10 secondes

  // ── MAPPING DES LANGUES POUR DEEPL ─────────────────────────────────────────
  // DeepL exige des codes cibles spécifiques en majuscules (ex: EN-US, PT-PT).
  const DEEPL_LANGUES_CIBLES_SPECIALES = {
    en: "EN-US",
    "en-us": "EN-US",
    "en-gb": "EN-GB",
    pt: "PT-PT",
    "pt-pt": "PT-PT",
    "pt-br": "PT-BR",
    zh: "ZH-HANS",
    "zh-cn": "ZH-HANS",
    "zh-tw": "ZH-HANT"
  };

  /**
   * Normalise un code BCP-47 vers le format attendu par la langue cible DeepL.
   * @param {string} code - Code langue source ou BCP-47 (ex: "fr", "en", "pt-br")
   * @returns {string} Code cible normalisé pour DeepL (ex: "FR", "EN-US", "PT-BR")
   */
  function normaliserCodeDeepL(code) {
    if (!code) return "EN-US";
    const codeNettoye = code.toLowerCase().trim();
    if (DEEPL_LANGUES_CIBLES_SPECIALES[codeNettoye]) {
      return DEEPL_LANGUES_CIBLES_SPECIALES[codeNettoye];
    }
    // Langues standard : uniquement les 2 premières lettres en majuscules (ex: FR, DE, ES, JA)
    return codeNettoye.split("-")[0].toUpperCase();
  }

  /**
   * Détermine l'URL de l'API DeepL selon la clé fournie ou le plan configuré.
   * Les clés du plan gratuit DeepL se terminent conventionnellement par ':fx'.
   * @param {string} apiKey - Clé d'authentification DeepL
   * @param {string} [plan='auto'] - 'auto', 'free' ou 'pro'
   * @returns {string} URL de base de l'endpoint DeepL
   */
  function obtenirEndpointDeepL(apiKey, plan = "auto") {
    if (plan === "free" || (plan === "auto" && apiKey && apiKey.trim().endsWith(":fx"))) {
      return "https://api-free.deepl.com/v2/translate";
    }
    return "https://api.deepl.com/v2/translate";
  }

  // ── 1. FOURNISSEUR GOOGLE TRANSLATE (DÉFAUT) ───────────────────────────────
  const FournisseurGoogle = {
    id: "google",
    label: "Google",
    nomComplet: "Google Translate",

    /**
     * Traduit un texte via Google Translate (client gtx).
     * @param {string} texte - Texte brut à traduire
     * @param {string} source - Langue source ("auto" ou code)
     * @param {string} cible - Langue cible
     * @param {Object} [_config] - Configuration optionnelle
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(texte, source, cible, _config = {}) {
      const url =
        "https://translate.googleapis.com/translate_a/single" +
        "?client=gtx" +
        "&sl=" + encodeURIComponent(source) +
        "&tl=" + encodeURIComponent(cible) +
        "&dt=t";

      let reponse;
      try {
        reponse = await fetch(url, {
          method: "POST",
          signal: AbortSignal.timeout(TIMEOUT_TRADUCTION_MS),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "q=" + encodeURIComponent(texte)
        });
      } catch (erreur) {
        if (erreur && (erreur.name === "TimeoutError" || erreur.name === "AbortError")) {
          throw new Error("TIMEOUT");
        }
        throw new Error("NETWORK");
      }

      if (!reponse.ok) {
        if (reponse.status === 429) throw new Error("RATE_LIMITED");
        if (reponse.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
        throw new Error("SERVICE_UNAVAILABLE");
      }

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

        if (!traduction.trim()) throw new Error("SERVICE_UNAVAILABLE");

        return {
          success: true,
          text: traduction,
          detectedLang: donnees[2] || null
        };
      }

      throw new Error("SERVICE_UNAVAILABLE");
    }
  };

  // ── 2. FOURNISSEUR DEEPL API ───────────────────────────────────────────────
  const FournisseurDeepL = {
    id: "deepl",
    label: "DeepL",
    nomComplet: "DeepL API",

    /**
     * Traduit un texte via l'API DeepL.
     * @param {string} texte - Texte brut à traduire
     * @param {string} source - Langue source ("auto" ou code)
     * @param {string} cible - Langue cible
     * @param {Object} config - Configuration ({ apiKey, plan })
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(texte, source, cible, config = {}) {
      const apiKey = config.apiKey ? config.apiKey.trim() : "";
      if (!apiKey) {
        throw new Error("UNAUTHORIZED");
      }

      const endpoint = obtenirEndpointDeepL(apiKey, config.plan || "auto");
      const targetLang = normaliserCodeDeepL(cible);

      const payload = {
        text: [texte],
        target_lang: targetLang
      };

      if (source && source !== "auto") {
        payload.source_lang = source.split("-")[0].toUpperCase();
      }

      let reponse;
      try {
        reponse = await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(TIMEOUT_TRADUCTION_MS),
          headers: {
            "Authorization": `DeepL-Auth-Key ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      } catch (erreur) {
        if (erreur && (erreur.name === "TimeoutError" || erreur.name === "AbortError")) {
          throw new Error("TIMEOUT");
        }
        throw new Error("NETWORK");
      }

      if (!reponse.ok) {
        if (reponse.status === 403 || reponse.status === 401) throw new Error("UNAUTHORIZED");
        if (reponse.status === 429 || reponse.status === 456) throw new Error("RATE_LIMITED");
        if (reponse.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
        throw new Error("SERVICE_UNAVAILABLE");
      }

      let donnees;
      try {
        donnees = await reponse.json();
      } catch {
        throw new Error("SERVICE_UNAVAILABLE");
      }

      if (donnees && donnees.translations && Array.isArray(donnees.translations) && donnees.translations[0]) {
        const item = donnees.translations[0];
        const traduction = item.text || "";
        if (!traduction.trim()) throw new Error("SERVICE_UNAVAILABLE");

        return {
          success: true,
          text: traduction,
          detectedLang: item.detected_source_language ? item.detected_source_language.toLowerCase() : null
        };
      }

      throw new Error("SERVICE_UNAVAILABLE");
    }
  };

  // ── 3. FOURNISSEUR LIBRETRANSLATE ──────────────────────────────────────────
  const FournisseurLibreTranslate = {
    id: "libretranslate",
    label: "LibreTranslate",
    nomComplet: "LibreTranslate",

    /**
     * Traduit un texte via une instance LibreTranslate (publique ou locale).
     * @param {string} texte - Texte brut à traduire
     * @param {string} source - Langue source ("auto" ou code)
     * @param {string} cible - Langue cible
     * @param {Object} config - Configuration ({ url, apiKey })
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(texte, source, cible, config = {}) {
      const baseUrl = (config.url && config.url.trim()) ? config.url.trim().replace(/\/+$/, "") : "https://libretranslate.com";
      const endpoint = `${baseUrl}/translate`;

      const payload = {
        q: texte,
        source: source === "auto" ? "auto" : source.split("-")[0].toLowerCase(),
        target: cible.split("-")[0].toLowerCase(),
        format: "text"
      };

      if (config.apiKey && config.apiKey.trim()) {
        payload.api_key = config.apiKey.trim();
      }

      let reponse;
      try {
        reponse = await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(TIMEOUT_TRADUCTION_MS),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (erreur) {
        if (erreur && (erreur.name === "TimeoutError" || erreur.name === "AbortError")) {
          throw new Error("TIMEOUT");
        }
        throw new Error("NETWORK");
      }

      if (!reponse.ok) {
        if (reponse.status === 403 || reponse.status === 401) throw new Error("UNAUTHORIZED");
        if (reponse.status === 429) throw new Error("RATE_LIMITED");
        if (reponse.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
        throw new Error("SERVICE_UNAVAILABLE");
      }

      let donnees;
      try {
        donnees = await reponse.json();
      } catch {
        throw new Error("SERVICE_UNAVAILABLE");
      }

      if (donnees && (donnees.translatedText !== undefined)) {
        const traduction = donnees.translatedText || "";
        if (!traduction.trim()) throw new Error("SERVICE_UNAVAILABLE");

        const detectedLang = donnees.detectedLanguage && donnees.detectedLanguage.language
          ? donnees.detectedLanguage.language.toLowerCase()
          : null;

        return {
          success: true,
          text: traduction,
          detectedLang: detectedLang
        };
      }

      throw new Error("SERVICE_UNAVAILABLE");
    }
  };

  // ── REGISTRE & GESTIONNAIRE GLOBAL ─────────────────────────────────────────
  const FOURNISSEURS = {
    google: FournisseurGoogle,
    deepl: FournisseurDeepL,
    libretranslate: FournisseurLibreTranslate
  };

  const MTProviders = {
    FOURNISSEURS,
    normaliserCodeDeepL,
    obtenirEndpointDeepL,

    /**
     * Récupère un fournisseur par son identifiant.
     * @param {string} id - 'google', 'deepl', 'libretranslate'
     * @returns {Object} Le fournisseur correspondant (ou Google par défaut)
     */
    obtenirFournisseur(id) {
      return FOURNISSEURS[id] || FournisseurGoogle;
    },

    /**
     * Exécute une traduction avec la configuration demandée.
     * @param {Object} config - Configuration active ({ provider, apiKey, url, plan })
     * @param {string} texte - Texte à traduire
     * @param {string} source - Langue source
     * @param {string} cible - Langue cible
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(config, texte, source, cible) {
      const providerId = (config && config.provider) || "google";
      const fournisseur = MTProviders.obtenirFournisseur(providerId);
      return await fournisseur.traduire(texte, source, cible, config);
    },

    /**
     * Teste la connexion et la validité d'une configuration fournisseur en direct.
     * @param {Object} config - Configuration à tester
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async testerConnexion(config) {
      const providerId = (config && config.provider) || "google";
      const fournisseur = MTProviders.obtenirFournisseur(providerId);

      try {
        const resultat = await fournisseur.traduire("Hello", "en", "fr", config);
        if (resultat && resultat.success && resultat.text) {
          return { success: true, message: "Connexion réussie !" };
        }
        return { success: false, message: "Réponse inattendue du fournisseur." };
      } catch (err) {
        return { success: false, message: err.message || "Erreur de connexion." };
      }
    }
  };

  // Exposition pour le background script et les tests unitaires Node.js
  globalThis.MTProviders = MTProviders;
})();
