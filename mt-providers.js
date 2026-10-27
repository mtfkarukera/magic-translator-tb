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
  const TIMEOUT_CLOUD_MS = 10000; // 10 secondes pour les services Cloud rapides (Google, DeepL, MyMemory)
  const TIMEOUT_LOCAL_MS = 60000; // 60 secondes pour les moteurs locaux ou lourds (LibreTranslate, Ollama, LM Studio)
  const TIMEOUT_TRADUCTION_MS = TIMEOUT_CLOUD_MS; // Rétrocompatibilité interne

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
  const GOOGLE_PA_KEY = "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA";

  const FournisseurGoogle = {
    id: "google",
    label: "Google",
    nomComplet: "Google Translate",

    /**
     * Traduit un texte via Google Translate (API Translate-PA WebExtensions).
     * En cas d'indisponibilité ou blocage, bascule automatiquement sur MyMemory en secours.
     * @param {string} texte - Texte brut à traduire
     * @param {string} source - Langue source ("auto" ou code)
     * @param {string} cible - Langue cible
     * @param {Object} [config] - Configuration optionnelle
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(texte, source, cible, config = {}) {
      const params = new URLSearchParams();
      params.append("params.client", "gtx");
      params.append("query.source_language", source || "auto");
      params.append("query.target_language", cible);
      params.append("query.display_language", cible);
      params.append("query.text", texte);
      params.append("key", GOOGLE_PA_KEY);
      params.append("data_types", "TRANSLATION");

      const url = `https://translate-pa.googleapis.com/v1/translate?${params.toString()}`;

      let reponse;
      try {
        reponse = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(TIMEOUT_TRADUCTION_MS)
        });
      } catch (erreur) {
        // En cas de timeout ou erreur réseau, repli automatique sur MyMemory
        try {
          return await FournisseurMyMemory.traduire(texte, source, cible, config);
        } catch {
          if (erreur && (erreur.name === "TimeoutError" || erreur.name === "AbortError")) {
            throw new Error("TIMEOUT");
          }
          throw new Error("NETWORK");
        }
      }

      if (!reponse.ok) {
        // En cas d'erreur HTTP (ex: 429 ou 500), repli automatique sur MyMemory
        try {
          return await FournisseurMyMemory.traduire(texte, source, cible, config);
        } catch {
          if (reponse.status === 429) throw new Error("RATE_LIMITED");
          throw new Error("SERVICE_UNAVAILABLE");
        }
      }

      let donnees;
      try {
        donnees = await reponse.json();
      } catch {
        try {
          return await FournisseurMyMemory.traduire(texte, source, cible, config);
        } catch {
          throw new Error("SERVICE_UNAVAILABLE");
        }
      }

      if (donnees && typeof donnees.translation === "string") {
        return {
          success: true,
          text: donnees.translation,
          detectedLang: donnees.sourceLanguage || null
        };
      }

      // Format inattendu : tentative de secours sur MyMemory
      return await FournisseurMyMemory.traduire(texte, source, cible, config);
    }
  };

  // ── 1b. FOURNISSEUR MYMEMORY API (SECOURS & AUTONOME) ──────────────────────

  /**
   * Extrait les espaces de tête et de queue pour ne pas les envoyer à MyMemory
   * et les réattacher fidèlement à la reconstitution.
   * @param {string} txt - Texte source
   * @returns {{lead: string, coeur: string, trail: string}}
   */
  function extraireEspacesTexte(txt) {
    const lead = txt.match(/^\s*/)[0];
    const trail = txt.match(/\s*$/)[0];
    const coeur = txt.slice(lead.length, txt.length - trail.length);
    return { lead, coeur, trail };
  }

  /**
   * Nettoie les balises XLIFF (ex: <g id="1">...</g>) et entités HTML renvoyées par MyMemory.
   * @param {string} txt - Texte renvoyé par l'API MyMemory
   * @returns {string} Texte nettoyé
   */
  function nettoyerTraductionMyMemory(txt) {
    if (!txt) return "";
    return txt
      .replace(/<\/?g[^>]*>/gi, "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  /**
   * Découpe un texte trop long en tranches de taille maximale (par défaut 450 car.)
   * pour respecter la limite stricte de 500 caractères par requête de l'API MyMemory.
   * Privilégie les coupures naturelles (\n, . , , , espace) pour préserver le sens.
   * @param {string} texte - Texte à découper
   * @param {number} [maxLen=450] - Taille maximale par tranche
   * @returns {string[]} Tranches dont la concaténation reconstitue exactement le texte
   */
  function decouperPourMyMemory(texte, maxLen = 450) {
    if (!texte || texte.length <= maxLen) return [texte];
    const tranches = [];
    let reste = texte;
    while (reste.length > maxLen) {
      let coupe = reste.lastIndexOf("\n", maxLen);
      if (coupe < maxLen * 0.3) coupe = reste.lastIndexOf(". ", maxLen);
      if (coupe >= maxLen * 0.3 && reste[coupe] === ".") coupe += 1;
      if (coupe < maxLen * 0.3) coupe = reste.lastIndexOf(", ", maxLen);
      if (coupe >= maxLen * 0.3 && reste[coupe] === ",") coupe += 1;
      if (coupe < maxLen * 0.3) coupe = reste.lastIndexOf(" ", maxLen);
      if (coupe < maxLen * 0.3) coupe = maxLen; // Coupe franche si aucun délimiteur

      tranches.push(reste.slice(0, coupe));
      reste = reste.slice(coupe);
    }
    if (reste) tranches.push(reste);
    return tranches;
  }

  const FournisseurMyMemory = {
    id: "mymemory",
    label: "MyMemory",
    nomComplet: "MyMemory API",

    /**
     * Exécute une requête unitaire vers MyMemory pour un segment de <= 450 caractères.
     * @param {string} segment - Segment de texte (sans espaces superflus)
     * @param {string} langpair - Paire de langues (ex: "fr|en")
     * @param {Object} config - Configuration optionnelle (mymemoryEmail)
     * @returns {Promise<{text: string, detectedLang: string|null}>}
     */
    async _traduireRequete(segment, langpair, config) {
      let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(segment)}&langpair=${encodeURIComponent(langpair)}`;
      const email = (config.mymemoryEmail || config.email || "").trim();
      if (email) {
        url += `&de=${encodeURIComponent(email)}`;
      }

      let reponse;
      try {
        reponse = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(TIMEOUT_TRADUCTION_MS)
        });
      } catch (erreur) {
        if (erreur && (erreur.name === "TimeoutError" || erreur.name === "AbortError")) {
          throw new Error("TIMEOUT");
        }
        throw new Error("NETWORK");
      }

      if (!reponse.ok) {
        if (reponse.status === 429) throw new Error("RATE_LIMITED");
        throw new Error("SERVICE_UNAVAILABLE");
      }

      let donnees;
      try {
        donnees = await reponse.json();
      } catch {
        throw new Error("SERVICE_UNAVAILABLE");
      }

      if (!donnees) {
        throw new Error("SERVICE_UNAVAILABLE");
      }

      if (donnees.responseStatus && Number(donnees.responseStatus) !== 200) {
        if (Number(donnees.responseStatus) === 429 || Number(donnees.responseStatus) === 403) {
          throw new Error("RATE_LIMITED");
        }
        throw new Error("SERVICE_UNAVAILABLE");
      }

      if (donnees.quotaFinished) {
        throw new Error("RATE_LIMITED");
      }

      if (donnees.responseData && typeof donnees.responseData.translatedText === "string") {
        const traduit = donnees.responseData.translatedText;
        // Détection d'avertissement de quota ou de limite dépassée
        if (traduit.includes("MYMEMORY WARNING") || traduit.includes("QUERY LENGTH LIMIT")) {
          throw new Error("RATE_LIMITED");
        }

        let detectedLang = null;
        if (Array.isArray(donnees.matches) && donnees.matches.length > 0) {
          const premierMatch = donnees.matches[0];
          if (premierMatch && premierMatch.source) {
            detectedLang = premierMatch.source.split("-")[0].toLowerCase();
          }
        }

        return {
          text: nettoyerTraductionMyMemory(traduit),
          detectedLang
        };
      }

      throw new Error("SERVICE_UNAVAILABLE");
    },

    /**
     * Traduit un texte via MyMemory (Translated.net) en gérant automatiquement
     * le sous-découpage pour les textes de plus de 450 caractères.
     * @param {string} texte - Texte brut à traduire
     * @param {string} source - Langue source ("auto" ou code)
     * @param {string} cible - Langue cible
     * @param {Object} [config] - Configuration optionnelle (mymemoryEmail)
     * @returns {Promise<{success: boolean, text: string, detectedLang: string|null}>}
     */
    async traduire(texte, source, cible, config = {}) {
      const src = (source === "auto" || !source) ? "autodetect" : source.toLowerCase();
      const tgt = cible.toLowerCase();
      const langpair = `${src}|${tgt}`;

      // Si le texte est vide ou ne contient que des espaces, le renvoyer tel quel
      if (!texte || !texte.trim()) {
        return { success: true, text: texte, detectedLang: null };
      }

      // Si le texte est court (<= 450 caractères), traitement direct
      if (texte.length <= 450) {
        const { lead, coeur, trail } = extraireEspacesTexte(texte);
        if (!coeur.trim()) {
          return { success: true, text: texte, detectedLang: null };
        }
        const resultat = await this._traduireRequete(coeur, langpair, config);
        return {
          success: true,
          text: lead + resultat.text + trail,
          detectedLang: resultat.detectedLang
        };
      }

      // Si le texte dépasse 450 caractères, découpage en sous-tranches sécurisées
      const tranches = decouperPourMyMemory(texte, 450);
      const morceauxTraduits = [];
      let detectedLang = null;

      for (const tranche of tranches) {
        const { lead, coeur, trail } = extraireEspacesTexte(tranche);
        // Si la tranche est vide ou ne contient que des espaces, la préserver sans appel réseau
        if (!coeur.trim()) {
          morceauxTraduits.push(tranche);
          continue;
        }
        const res = await this._traduireRequete(coeur, langpair, config);
        morceauxTraduits.push(lead + res.text + trail);
        if (!detectedLang && res.detectedLang) {
          detectedLang = res.detectedLang;
        }
      }

      return {
        success: true,
        text: morceauxTraduits.join(""),
        detectedLang
      };
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
      let baseUrl = (config.url && config.url.trim()) ? config.url.trim() : "https://libretranslate.com";
      baseUrl = baseUrl.replace(/\/translate\/?$/i, "").replace(/\/+$/, "");
      try {
        const u = new URL(baseUrl);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          baseUrl = "https://libretranslate.com";
        }
      } catch {
        baseUrl = "https://libretranslate.com";
      }
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
          signal: AbortSignal.timeout(TIMEOUT_LOCAL_MS),
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`;

      const promptSysteme = `You are a professional translator. Translate the text into ${cibleNom}. Output ONLY the raw translated text with NO explanations, NO quotes, NO markdown formatting. Preserve any line breaks, formatting tokens, and unique sentinel identifiers (such as MTSEP...) exactly as they appear.`;

      const payload = {
        systemInstruction: {
          parts: [{ text: promptSysteme }]
        },
        contents: [
          {
            parts: [
              { text: texte }
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
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
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
          throw new Error("UNAUTHORIZED");
        }
        if (reponse.status === 404) {
          throw new Error(errMessage || `Modèle Gemini "${modele}" introuvable (404).`);
        }
        if (reponse.status === 429) {
          throw new Error("RATE_LIMITED");
        }
        throw new Error("SERVICE_UNAVAILABLE");
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
      let baseUrl = (config.url || config.llmBaseUrl || "").trim();
      const apiKey = config.apiKey ? config.apiKey.trim() : (config.llmApiKey ? config.llmApiKey.trim() : "");
      const modele = (config.model || config.llmModel || "gpt-4o-mini").trim();
      const preset = config.preset || config.llmPreset || "openai";

      if (preset === "openai") baseUrl = "https://api.openai.com";
      else if (preset === "groq") baseUrl = "https://api.groq.com/openai";
      else if (preset === "mistral") baseUrl = "https://api.mistral.ai";
      else if (!baseUrl) {
        baseUrl = preset === "lmstudio" ? "http://localhost:1234" : "http://localhost:11434";
      }

      try {
        const u = new URL(baseUrl);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          baseUrl = "http://localhost:11434";
        }
      } catch {
        baseUrl = "http://localhost:11434";
      }

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
            content: `You are a professional translator. Translate the user text accurately into ${cibleNom}. Output ONLY the raw translated text, with no markdown code blocks, quotes, preamble, or comments. Preserve any line breaks, formatting tokens, and unique sentinel identifiers (such as MTSEP...) exactly as they appear.`
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

      const estLocalOuLourd = preset === "ollama" || preset === "lmstudio" || preset === "custom";
      const timeoutMs = estLocalOuLourd ? TIMEOUT_LOCAL_MS : TIMEOUT_CLOUD_MS;

      let reponse;
      try {
        reponse = await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
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
    mymemory: FournisseurMyMemory,
    deepl: FournisseurDeepL,
    libretranslate: FournisseurLibreTranslate,
    gemini: FournisseurGemini,
    llm: FournisseurOpenAICompatible
  };

  const MTProviders = {
    FOURNISSEURS,
    TIMEOUT_CLOUD_MS,
    TIMEOUT_LOCAL_MS,
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
      const url = "https://generativelanguage.googleapis.com/v1beta/models";
      let reponse;
      try {
        reponse = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_TRADUCTION_MS),
          headers: {
            "x-goog-api-key": apiKey.trim()
          }
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
          const url = config.llmBaseUrl || config.url || (preset === "lmstudio" ? "http://localhost:1234" : "http://localhost:11434");
          const u = new URL(url);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            return "http://localhost/*";
          }
          // Les match patterns WebExtension ne supportent pas de numéro de port
          return `${u.protocol}//${u.hostname}/*`;
        } catch {
          return "http://localhost/*";
        }
      }
      if (provider === "libretranslate") {
        try {
          const url = config.libretranslateUrl || config.url || "https://libretranslate.com";
          const u = new URL(url);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            return "https://libretranslate.com/*";
          }
          return `${u.protocol}//${u.hostname}/*`;
        } catch {
          return "https://libretranslate.com/*";
        }
      }
      if (provider === "mymemory") {
        return "https://api.mymemory.translated.net/*";
      }
      return "https://translate-pa.googleapis.com/*";
    }
  };

  // Exposition pour le background script et les tests unitaires Node.js
  globalThis.MTProviders = MTProviders;
})();

