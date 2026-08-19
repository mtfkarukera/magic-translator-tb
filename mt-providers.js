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

  // ── TABLE DES LANGUES POUR LES PROMPTS LLM ─────────────────────────────────
  const NOMS_LANGUES_LLM = {
    fr: "French", en: "English", es: "Spanish", de: "German", it: "Italian",
    pt: "Portuguese", "pt-br": "Brazilian Portuguese", "pt-pt": "European Portuguese",
    ja: "Japanese", "zh-cn": "Simplified Chinese", "zh-tw": "Traditional Chinese", zh: "Chinese",
    ru: "Russian", ar: "Arabic", nl: "Dutch", pl: "Polish", tr: "Turkish",
    vi: "Vietnamese", ko: "Korean", sv: "Swedish", no: "Norwegian", da: "Danish",
    fi: "Finnish", el: "Greek", cs: "Czech", hu: "Hungarian", ro: "Romanian",
    uk: "Ukrainian", id: "Indonesian", hi: "Hindi", th: "Thai", he: "Hebrew"
  };

  /**
   * Retourne le nom de la langue en anglais pour le prompt système du LLM.
   * @param {string} code - Code langue ISO/BCP-47 (ex: "fr", "pt-br")
   * @returns {string} Nom de la langue en clair
   */
  function obtenirNomLangue(code) {
    if (!code) return "English";
    const c = code.toLowerCase().trim();
    return NOMS_LANGUES_LLM[c] || NOMS_LANGUES_LLM[c.split("-")[0]] || code;
  }

  /**
   * Nettoie la réponse textuelle générée par un LLM (supprime balises markdown et guillemets superflus).
   * @param {string} texte - Texte brut issu du LLM
   * @returns {string} Texte traduit épuré
   */
  function nettoyerReponseLLM(texte) {
    if (!texte) return "";
    let propre = texte.trim();
    // Suppression des encadrements de blocs de code markdown ```...```
    if (propre.startsWith("```") && propre.endsWith("```")) {
      propre = propre.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
    }
    // Suppression des guillemets enveloppants si le LLM a entouré tout le texte
    if ((propre.startsWith('"') && propre.endsWith('"') && propre.length >= 2) ||
        (propre.startsWith("«") && propre.endsWith("»") && propre.length >= 2)) {
      propre = propre.slice(1, -1).trim();
    }
    return propre;
  }

  // ── 4. FOURNISSEUR GOOGLE GEMINI API ───────────────────────────────────────
  const FournisseurGemini = {
    id: "gemini",
    label: "Gemini",
    nomComplet: "Google Gemini API",

    /**
     * Traduit un texte via l'API REST de Google Gemini (Google AI Studio).
     * @param {string} texte - Texte brut à traduire
     * @param {string} _source - Langue source ("auto" ou code)
     * @param {string} cible - Langue cible
     * @param {Object} config - Configuration ({ apiKey, model, ... })
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(texte, _source, cible, config = {}) {
      const apiKey = config.apiKey ? config.apiKey.trim() : (config.geminiApiKey ? config.geminiApiKey.trim() : "");
      if (!apiKey) {
        throw new Error("UNAUTHORIZED");
      }

      const modele = (config.model || config.geminiModel || "gemini-3.5-flash-lite").replace(/^models\//, "").trim();
      const cibleNom = obtenirNomLangue(cible);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const promptSysteme = `You are a professional translator. Translate the following text into ${cibleNom}. Output ONLY the raw translated text with NO explanations, NO quotes, NO markdown formatting.`;

      const payload = {
        contents: [
          {
            parts: [
              {
                text: `${promptSysteme}\n\nText to translate:\n${texte}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      };

      let reponse;
      try {
        reponse = await fetch(url, {
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
        let errMessage = "";
        try {
          const errData = await reponse.json();
          if (errData && errData.error && errData.error.message) {
            errMessage = errData.error.message;
          }
        } catch {
          /* ignore si le corps n'est pas du JSON */
        }

        if (reponse.status === 400 || reponse.status === 401 || reponse.status === 403) {
          throw new Error(errMessage || "UNAUTHORIZED");
        }
        if (reponse.status === 404) {
          throw new Error(errMessage || `Modèle Gemini "${modele}" introuvable (404).`);
        }
        if (reponse.status === 429) {
          throw new Error(errMessage || "RATE_LIMITED");
        }
        throw new Error(errMessage || "SERVICE_UNAVAILABLE");
      }

      let donnees;
      try {
        donnees = await reponse.json();
      } catch {
        throw new Error("SERVICE_UNAVAILABLE");
      }

      if (donnees && donnees.candidates && donnees.candidates[0] && donnees.candidates[0].content && donnees.candidates[0].content.parts && donnees.candidates[0].content.parts[0] && donnees.candidates[0].content.parts[0].text) {
        const traductionBrute = donnees.candidates[0].content.parts[0].text;
        const traduction = nettoyerReponseLLM(traductionBrute);
        if (!traduction) throw new Error("SERVICE_UNAVAILABLE");

        return {
          success: true,
          text: traduction,
          detectedLang: null
        };
      }

      throw new Error("SERVICE_UNAVAILABLE");
    }
  };

  // ── 5. FOURNISSEUR OPENAI-COMPATIBLE (HUB LLMS) ────────────────────────────
  const PRESET_LABELS = {
    openai: "OpenAI",
    groq: "Groq",
    mistral: "Mistral",
    ollama: "Ollama",
    lmstudio: "LM Studio",
    custom: "LLM"
  };

  /**
   * Construit l'URL d'endpoint chat/completions en normalisant les suffixes /v1.
   * @param {string} [baseUrl]
   * @returns {string}
   */
  function construireEndpointLLM(baseUrl) {
    const url = (baseUrl || "https://api.openai.com").trim().replace(/\/+$/, "");
    if (url.endsWith("/v1/chat/completions")) {
      return url;
    }
    if (url.endsWith("/v1")) {
      return `${url}/chat/completions`;
    }
    return `${url}/v1/chat/completions`;
  }

  const FournisseurOpenAICompatible = {
    id: "llm",
    label: "LLM",
    nomComplet: "Modèle de Langage (LLM)",

    obtenirLabel(config = {}) {
      const preset = config.preset || config.llmPreset || "custom";
      return PRESET_LABELS[preset] || "LLM";
    },

    /**
     * Traduit un texte via un endpoint OpenAI-compatible (OpenAI, Groq, Mistral, Ollama, LM Studio, etc.).
     * @param {string} texte - Texte brut à traduire
     * @param {string} _source - Langue source
     * @param {string} cible - Langue cible
     * @param {Object} config - Configuration ({ url, apiKey, model, preset, ... })
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(texte, _source, cible, config = {}) {
      const baseUrl = (config.url || config.llmBaseUrl || "https://api.openai.com").trim();
      const apiKey = config.apiKey ? config.apiKey.trim() : (config.llmApiKey ? config.llmApiKey.trim() : "");
      const modele = (config.model || config.llmModel || "gpt-4o-mini").trim();
      const preset = config.preset || config.llmPreset || "openai";

      // Rejet immédiat si clé manquante pour les fournisseurs Cloud
      const exigeCle = preset === "openai" || preset === "groq" || preset === "mistral";
      if (exigeCle && !apiKey) {
        throw new Error("UNAUTHORIZED");
      }

      const endpoint = construireEndpointLLM(baseUrl);
      const cibleNom = obtenirNomLangue(cible);

      const payload = {
        model: modele,
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the user text accurately into ${cibleNom}. Output ONLY the raw translated text, with no markdown code blocks, quotes, preamble, or comments.`
          },
          {
            role: "user",
            content: texte
          }
        ],
        temperature: 0.2
      };

      const headers = {
        "Content-Type": "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      let reponse;
      try {
        reponse = await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(TIMEOUT_TRADUCTION_MS),
          headers,
          body: JSON.stringify(payload)
        });
      } catch (erreur) {
        if (erreur && (erreur.name === "TimeoutError" || erreur.name === "AbortError")) {
          throw new Error("TIMEOUT");
        }
        throw new Error("NETWORK");
      }

      if (!reponse.ok) {
        if (reponse.status === 401 || reponse.status === 403) throw new Error("UNAUTHORIZED");
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

      if (donnees && donnees.choices && donnees.choices[0] && donnees.choices[0].message && donnees.choices[0].message.content) {
        const traductionBrute = donnees.choices[0].message.content;
        const traduction = nettoyerReponseLLM(traductionBrute);
        if (!traduction) throw new Error("SERVICE_UNAVAILABLE");

        return {
          success: true,
          text: traduction,
          detectedLang: null
        };
      }

      throw new Error("SERVICE_UNAVAILABLE");
    }
  };

  // ── REGISTRE & GESTIONNAIRE GLOBAL ─────────────────────────────────────────
  const FOURNISSEURS = {
    google: FournisseurGoogle,
    deepl: FournisseurDeepL,
    libretranslate: FournisseurLibreTranslate,
    gemini: FournisseurGemini,
    llm: FournisseurOpenAICompatible
  };

  const MTProviders = {
    FOURNISSEURS,
    normaliserCodeDeepL,
    obtenirEndpointDeepL,
    obtenirNomLangue,
    nettoyerReponseLLM,
    construireEndpointLLM,

    /**
     * Récupère un fournisseur par son identifiant.
     * @param {string} id - 'google', 'deepl', 'libretranslate', 'gemini', 'llm'
     * @param {Object} [config] - Configuration optionnelle pour dynamiser le label
     * @returns {Object} Le fournisseur correspondant (ou Google par défaut)
     */
    obtenirFournisseur(id, config = {}) {
      const fournisseur = FOURNISSEURS[id] || FournisseurGoogle;
      if (id === "llm" && fournisseur.obtenirLabel) {
        return {
          ...fournisseur,
          label: fournisseur.obtenirLabel(config)
        };
      }
      return fournisseur;
    },

    /**
     * Exécute une traduction avec la configuration demandée.
     * @param {Object} config - Configuration active
     * @param {string} texte - Texte à traduire
     * @param {string} source - Langue source
     * @param {string} cible - Langue cible
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(config, texte, source, cible) {
      const providerId = (config && config.provider) || "google";
      const fournisseur = MTProviders.obtenirFournisseur(providerId, config);
      return await fournisseur.traduire(texte, source, cible, config);
    },

    /**
     * Teste la connexion et la validité d'une configuration fournisseur en direct.
     * @param {Object} config - Configuration à tester
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async testerConnexion(config) {
      const providerId = (config && config.provider) || "google";
      const fournisseur = MTProviders.obtenirFournisseur(providerId, config);

      try {
        const resultat = await fournisseur.traduire("Hello", "en", "fr", config);
        if (resultat && resultat.success && resultat.text) {
          return { success: true, message: "Connexion réussie !" };
        }
        return { success: false, message: "Réponse inattendue du fournisseur." };
      } catch (err) {
        return { success: false, message: err.message || "Erreur de connexion." };
      }
    },

    /**
     * Interroge l'API officielle Google pour récupérer en temps réel la liste des modèles disponibles.
     * @param {string} apiKey - Clé d'API Google AI Studio
     * @returns {Promise<Array<{id: string, name: string, description: string}>>}
     */
    async listerModelesGemini(apiKey) {
      if (!apiKey || !apiKey.trim()) return [];
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
      let reponse;
      try {
        reponse = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_TRADUCTION_MS)
        });
      } catch (erreur) {
        if (erreur && (erreur.name === "TimeoutError" || erreur.name === "AbortError")) {
          throw new Error("TIMEOUT");
        }
        throw new Error("NETWORK");
      }

      if (!reponse.ok) {
        let errMessage = "";
        try {
          const errData = await reponse.json();
          if (errData && errData.error && errData.error.message) {
            errMessage = errData.error.message;
          }
        } catch {
          /* ignore si le corps n'est pas du JSON */
        }
        throw new Error(errMessage || `Erreur HTTP ${reponse.status}`);
      }

      let donnees;
      try {
        donnees = await reponse.json();
      } catch {
        throw new Error("Réponse JSON invalide de Google.");
      }

      if (!donnees || !Array.isArray(donnees.models)) return [];

      return donnees.models
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
        .map((m) => ({
          id: m.name.replace(/^models\//, ""),
          name: m.displayName || m.name.replace(/^models\//, ""),
          description: m.description || ""
        }));
    },

    /**
     * Calcule le pattern d'origine WebExtension requis pour le fournisseur sélectionné.
     * @param {string} provider
     * @param {Object} [config={}]
     * @returns {string}
     */
    obtenirPatternOrigine(provider, config = {}) {
      if (provider === "deepl") {
        const plan = config.deeplPlan || config.plan || "auto";
        const key = config.deeplApiKey || config.apiKey || "";
        if (plan === "free" || (plan === "auto" && key.endsWith(":fx"))) {
          return "https://api-free.deepl.com/*";
        }
        return "https://api.deepl.com/*";
      }
      if (provider === "gemini") {
        return "https://generativelanguage.googleapis.com/*";
      }
      if (provider === "llm") {
        const preset = config.llmPreset || config.preset || "openai";
        if (preset === "openai") return "https://api.openai.com/*";
        if (preset === "groq") return "https://api.groq.com/*";
        if (preset === "mistral") return "https://api.mistral.ai/*";
        try {
          const url = config.llmBaseUrl || config.url || "http://localhost:11434";
          const u = new URL(url);
          return `${u.origin}/*`;
        } catch {
          return "http://localhost:11434/*";
        }
      }
      if (provider === "libretranslate") {
        try {
          const url = config.libretranslateUrl || config.url || "https://libretranslate.com";
          const u = new URL(url);
          return `${u.origin}/*`;
        } catch {
          return "https://libretranslate.com/*";
        }
      }
      return "https://translate.googleapis.com/*";
    }
  };

  // Exposition pour le background script et les tests unitaires Node.js
  globalThis.MTProviders = MTProviders;
})();

