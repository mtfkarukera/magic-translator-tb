/**
 * Magic Translator — Script de la page d'options
 * ══════════════════════════════════════════════
 *
 * Gère le chargement, la validation en direct et la persistance des préférences
 * dans browser.storage.local, avec support multilingue i18n natif (7 langues).
 */

"use strict";

/**
 * Récupère un message localisé depuis browser.i18n.
 * @param {string} cle - Clé de message
 * @param {string} [repli=""] - Texte de repli si la clé est absente
 * @returns {string}
 */
function t(cle, repli = "") {
  try {
    if (typeof browser !== "undefined" && browser.i18n && browser.i18n.getMessage) {
      const msg = browser.i18n.getMessage(cle);
      if (msg) return msg;
    }
  } catch {
    // Ignorer
  }
  return repli;
}

/**
 * Parcourt le DOM et applique les traductions sur tous les éléments data-i18n*.
 */
function appliquerI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const cle = el.getAttribute("data-i18n");
    const msg = t(cle);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const cle = el.getAttribute("data-i18n-placeholder");
    const msg = t(cle);
    if (msg) el.placeholder = msg;
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const cle = el.getAttribute("data-i18n-title");
    const msg = t(cle);
    if (msg) el.title = msg;
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const cle = el.getAttribute("data-i18n-aria-label");
    const msg = t(cle);
    if (msg) el.setAttribute("aria-label", msg);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // ── Application immédiate de l'internationalisation ─────────────────────────
  appliquerI18n();

  // ── Éléments du DOM ────────────────────────────────────────────────────────
  const form = document.getElementById("form-options");
  const selectProvider = document.getElementById("select-provider");
  const providerBadge = document.getElementById("provider-badge");
  const helpProvider = document.getElementById("help-provider");

  const sectionDeepl = document.getElementById("section-deepl");
  const inputDeeplKey = document.getElementById("deepl-api-key");
  const selectDeeplPlan = document.getElementById("deepl-plan");
  const btnToggleDeeplKey = document.getElementById("btn-toggle-deepl-key");

  const sectionGemini = document.getElementById("section-gemini");
  const inputGeminiKey = document.getElementById("gemini-api-key");
  const selectGeminiModel = document.getElementById("gemini-model");
  const btnToggleGeminiKey = document.getElementById("btn-toggle-gemini-key");
  const btnRefreshGeminiModels = document.getElementById("btn-refresh-gemini-models");
  const helpGeminiModels = document.getElementById("help-gemini-models");

  const sectionLlm = document.getElementById("section-llm");
  const selectLlmPreset = document.getElementById("llm-preset");
  const inputLlmBaseUrl = document.getElementById("llm-base-url");
  const inputLlmApiKey = document.getElementById("llm-api-key");
  const inputLlmModel = document.getElementById("llm-model");
  const btnToggleLlmKey = document.getElementById("btn-toggle-llm-key");

  const sectionLibreTranslate = document.getElementById("section-libretranslate");
  const inputLibreTranslateUrl = document.getElementById("libretranslate-url");
  const inputLibreTranslateKey = document.getElementById("libretranslate-api-key");
  const btnToggleLtKey = document.getElementById("btn-toggle-lt-key");

  const statusContainer = document.getElementById("status-container");
  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");

  const btnTest = document.getElementById("btn-test");
  const btnSave = document.getElementById("btn-save");

  // ── Valeurs par défaut & Presets LLM ───────────────────────────────────────
  const DEFAUTS = {
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

  const LLM_PRESETS = {
    openai: {
      url: "https://api.openai.com",
      model: "gpt-4o-mini",
      keyPlaceholder: "sk-proj-...",
      requiresKey: true
    },
    groq: {
      url: "https://api.groq.com/openai",
      model: "llama-3.3-70b-versatile",
      keyPlaceholder: "gsk_...",
      requiresKey: true
    },
    mistral: {
      url: "https://api.mistral.ai",
      model: "mistral-small-latest",
      keyPlaceholder: "api_key...",
      requiresKey: true
    },
    ollama: {
      url: "http://localhost:11434",
      model: "llama3.2",
      keyPlaceholder: t("placeholderLlmApiKey", "Leave empty if no key required (local)"),
      requiresKey: false
    },
    lmstudio: {
      url: "http://localhost:1234",
      model: "local-model",
      keyPlaceholder: t("placeholderLlmApiKey", "Leave empty if no key required (local)"),
      requiresKey: false
    },
    custom: {
      url: "",
      model: "",
      keyPlaceholder: t("placeholderLlmApiKey", "Leave empty if no key required"),
      requiresKey: false
    }
  };

  /**
   * Affiche un message d'état dans le conteneur de statut.
   * @param {string} texte - Message à afficher
   * @param {'success'|'error'|'loading'} type - Type d'état
   */
  function afficherStatut(texte, type) {
    statusContainer.className = `mt-status-container mt-status-${type}`;
    statusContainer.classList.remove("mt-hidden");

    if (type === "loading") {
      statusIcon.textContent = "⏳";
    } else if (type === "success") {
      statusIcon.textContent = "✓";
    } else {
      statusIcon.textContent = "⚠";
    }

    statusText.textContent = texte;
  }

  /**
   * Met à jour la visibilité des sections en fonction du moteur sélectionné.
   */
  function actualiserAffichageFournisseur() {
    const provider = selectProvider.value;

    sectionDeepl.classList.add("mt-hidden");
    sectionGemini.classList.add("mt-hidden");
    sectionLlm.classList.add("mt-hidden");
    sectionLibreTranslate.classList.add("mt-hidden");

    if (provider === "google") {
      providerBadge.textContent = t("badgeDefault", "Par défaut");
      providerBadge.style.display = "inline-block";
      helpProvider.textContent = t("helpProviderGoogle", "Google Translate fonctionne immédiatement sans aucune clé d'API ni configuration.");
    } else if (provider === "deepl") {
      sectionDeepl.classList.remove("mt-hidden");
      providerBadge.textContent = "DeepL";
      providerBadge.style.display = "inline-block";
      helpProvider.textContent = t("helpDeeplKey", "DeepL API") + " (https://www.deepl.com/pro-api)";
    } else if (provider === "gemini") {
      sectionGemini.classList.remove("mt-hidden");
      providerBadge.textContent = "Gemini API";
      providerBadge.style.display = "inline-block";
      helpProvider.textContent = t("helpGeminiModels", "Google Gemini API");
    } else if (provider === "llm") {
      sectionLlm.classList.remove("mt-hidden");
      providerBadge.textContent = "LLMs Hub";
      providerBadge.style.display = "inline-block";
      helpProvider.textContent = t("helpLlmBaseUrl", "OpenAI, Groq, Mistral, Ollama, LM Studio");
    } else if (provider === "libretranslate") {
      sectionLibreTranslate.classList.remove("mt-hidden");
      providerBadge.textContent = "LibreTranslate";
      providerBadge.style.display = "inline-block";
      helpProvider.textContent = t("helpLibreTranslateUrl", "LibreTranslate API");
    }
  }

  /**
   * Actualise dynamiquement la liste des modèles Gemini depuis l'API officielle Google.
   * @param {string} apiKey - Clé d'API
   * @param {boolean} [silencieux=false] - Si vrai, pas de message de statut envahissant
   */
  async function actualiserModelesGemini(apiKey, silencieux = false) {
    if (!apiKey || !apiKey.trim()) {
      if (!silencieux) afficherStatut("Veuillez d'abord saisir une clé d'API Google AI Studio.", "error");
      return;
    }

    if (btnRefreshGeminiModels) {
      btnRefreshGeminiModels.disabled = true;
      btnRefreshGeminiModels.textContent = "⏳ Chargement…";
    }

    // Demande de permission si nécessaire
    await assurerPermissionsHote({ provider: "gemini", geminiApiKey: apiKey });

    try {
      const reponse = await browser.runtime.sendMessage({
        action: "listGeminiModels",
        apiKey: apiKey.trim()
      });

      if (reponse && reponse.success && Array.isArray(reponse.models) && reponse.models.length > 0) {
        const valeurActuelle = selectGeminiModel.value;
        selectGeminiModel.innerHTML = "";

        let optionTrouvee = false;
        let optionFlashLite = null;

        reponse.models.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.textContent = `${m.name} (${m.id})`;
          selectGeminiModel.appendChild(opt);

          if (m.id === valeurActuelle) optionTrouvee = true;
          if (!optionFlashLite && m.id.includes("flash-lite")) {
            optionFlashLite = m.id;
          }
        });

        if (optionTrouvee) {
          selectGeminiModel.value = valeurActuelle;
        } else if (optionFlashLite) {
          selectGeminiModel.value = optionFlashLite;
        } else if (selectGeminiModel.options.length > 0) {
          selectGeminiModel.selectedIndex = 0;
        }

        if (helpGeminiModels) {
          helpGeminiModels.textContent = `✓ ${reponse.models.length} modèles disponibles synchronisés avec Google AI Studio.`;
        }

        if (!silencieux) {
          afficherStatut(`✓ ${reponse.models.length} modèles Gemini synchronisés avec succès !`, "success");
        }
      } else {
        const err = (reponse && reponse.message) || "Aucun modèle retourné.";
        if (helpGeminiModels) helpGeminiModels.textContent = `⚠️ Erreur de synchronisation : ${err}`;
        if (!silencieux) afficherStatut(`Impossible d'actualiser les modèles : ${err}`, "error");
      }
    } catch (err) {
      if (helpGeminiModels) helpGeminiModels.textContent = `⚠️ Erreur : ${err.message}`;
      if (!silencieux) afficherStatut(`Erreur : ${err.message}`, "error");
    } finally {
      if (btnRefreshGeminiModels) {
        btnRefreshGeminiModels.disabled = false;
        btnRefreshGeminiModels.textContent = "🔄 Actualiser les modèles";
      }
    }
  }

  // ── Chargement initial des réglages ────────────────────────────────────────
  try {
    const stocke = await browser.storage.local.get(Object.keys(DEFAUTS));
    const config = { ...DEFAUTS, ...stocke };

    selectProvider.value = config.provider;
    inputDeeplKey.value = config.deeplApiKey;
    selectDeeplPlan.value = config.deeplPlan;

    inputGeminiKey.value = config.geminiApiKey;
    selectGeminiModel.value = config.geminiModel || "gemini-3.5-flash-lite";

    selectLlmPreset.value = config.llmPreset || "openai";
    inputLlmBaseUrl.value = config.llmBaseUrl || "https://api.openai.com";
    inputLlmApiKey.value = config.llmApiKey;
    inputLlmModel.value = config.llmModel || "gpt-4o-mini";

    inputLibreTranslateUrl.value = config.libretranslateUrl || "https://libretranslate.com";
    inputLibreTranslateKey.value = config.libretranslateApiKey;

    actualiserAffichageFournisseur();

    // Actualisation silencieuse des modèles si clé déjà configurée
    if (config.geminiApiKey) {
      actualiserModelesGemini(config.geminiApiKey, true);
    }
  } catch (err) {
    console.error("[MagicTranslator Options] Erreur de chargement :", err);
    afficherStatut("Impossible de charger les préférences.", "error");
  }

  // ── Événements de changement de fournisseur ─────────────────────────────────
  selectProvider.addEventListener("change", () => {
    actualiserAffichageFournisseur();
    statusContainer.classList.add("mt-hidden");
  });

  // ── Événements Gemini ───────────────────────────────────────────────────────
  if (btnRefreshGeminiModels) {
    btnRefreshGeminiModels.addEventListener("click", () => {
      actualiserModelesGemini(inputGeminiKey.value.trim());
    });
  }

  inputGeminiKey.addEventListener("blur", () => {
    if (inputGeminiKey.value.trim()) {
      actualiserModelesGemini(inputGeminiKey.value.trim(), true);
    }
  });

  // ── Changement de preset LLM ────────────────────────────────────────────────
  selectLlmPreset.addEventListener("change", () => {
    const preset = selectLlmPreset.value;
    const info = LLM_PRESETS[preset];
    if (info && preset !== "custom") {
      inputLlmBaseUrl.value = info.url;
      inputLlmModel.value = info.model;
      inputLlmApiKey.placeholder = info.keyPlaceholder;
    }
    statusContainer.classList.add("mt-hidden");
  });

  // ── Bascules Afficher / Masquer Mot de passe ────────────────────────────────
  function configurerBasculeMotDePasse(btn, input) {
    btn.addEventListener("click", () => {
      const estMasque = input.type === "password";
      input.type = estMasque ? "text" : "password";
      btn.textContent = estMasque ? "🔒" : "👁️";
      btn.setAttribute("aria-label", estMasque ? "Masquer la clé" : "Afficher la clé");
    });
  }

  configurerBasculeMotDePasse(btnToggleDeeplKey, inputDeeplKey);
  configurerBasculeMotDePasse(btnToggleGeminiKey, inputGeminiKey);
  configurerBasculeMotDePasse(btnToggleLlmKey, inputLlmApiKey);
  configurerBasculeMotDePasse(btnToggleLtKey, inputLibreTranslateKey);

  /**
   * Construit l'objet de configuration actuel depuis le formulaire.
   * @returns {Object}
   */
  function obtenirConfigFormulaire() {
    return {
      provider: selectProvider.value,
      deeplApiKey: inputDeeplKey.value.trim(),
      deeplPlan: selectDeeplPlan.value,
      geminiApiKey: inputGeminiKey.value.trim(),
      geminiModel: selectGeminiModel.value,
      llmPreset: selectLlmPreset.value,
      llmBaseUrl: inputLlmBaseUrl.value.trim(),
      llmApiKey: inputLlmApiKey.value.trim(),
      llmModel: inputLlmModel.value.trim() || "gpt-4o-mini",
      libretranslateUrl: inputLibreTranslateUrl.value.trim() || "https://libretranslate.com",
      libretranslateApiKey: inputLibreTranslateKey.value.trim()
    };
  }

  /**
   * Vérifie et demande les permissions d'accès au domaine du fournisseur si nécessaire.
   * @param {Object} config
   * @returns {Promise<boolean>}
   */
  async function assurerPermissionsHote(config) {
    let pattern = "";
    if (config.provider === "deepl") {
      const plan = config.deeplPlan || "auto";
      const key = config.deeplApiKey || "";
      if (plan === "free" || (plan === "auto" && key.endsWith(":fx"))) {
        pattern = "https://api-free.deepl.com/*";
      } else {
        pattern = "https://api.deepl.com/*";
      }
    } else if (config.provider === "gemini") {
      pattern = "https://generativelanguage.googleapis.com/*";
    } else if (config.provider === "llm") {
      const preset = config.llmPreset || "openai";
      if (preset === "openai") {
        pattern = "https://api.openai.com/*";
      } else if (preset === "groq") {
        pattern = "https://api.groq.com/*";
      } else if (preset === "mistral") {
        pattern = "https://api.mistral.ai/*";
      } else {
        try {
          const u = new URL(config.llmBaseUrl || "http://localhost:11434");
          pattern = `${u.origin}/*`;
        } catch {
          return false;
        }
      }
    } else if (config.provider === "libretranslate") {
      try {
        const u = new URL(config.libretranslateUrl || "https://libretranslate.com");
        pattern = `${u.origin}/*`;
      } catch {
        return false;
      }
    } else {
      pattern = "https://translate.googleapis.com/*";
    }

    try {
      if (browser.permissions && browser.permissions.contains) {
        const aDeja = await browser.permissions.contains({ origins: [pattern] });
        if (!aDeja && browser.permissions.request) {
          const accorde = await browser.permissions.request({ origins: [pattern] });
          return Boolean(accorde);
        }
      }
      return true;
    } catch (err) {
      console.warn("[MagicTranslator Options] Demande de permissions :", err);
      return true;
    }
  }

  // ── Test de connexion en direct ────────────────────────────────────────────
  btnTest.addEventListener("click", async () => {
    const config = obtenirConfigFormulaire();
    const provider = config.provider;

    // Validation préalable
    if (provider === "deepl" && !config.deeplApiKey) {
      afficherStatut("Veuillez renseigner votre clé d'API DeepL avant de tester.", "error");
      inputDeeplKey.focus();
      return;
    }

    if (provider === "gemini" && !config.geminiApiKey) {
      afficherStatut("Veuillez renseigner votre clé d'API Google AI Studio avant de tester.", "error");
      inputGeminiKey.focus();
      return;
    }

    if (provider === "llm") {
      const preset = config.llmPreset;
      const exigeCle = preset === "openai" || preset === "groq" || preset === "mistral";
      if (exigeCle && !config.llmApiKey) {
        afficherStatut(`Veuillez renseigner votre clé d'API pour ${selectLlmPreset.selectedOptions[0].text.split("(")[0].trim()}.`, "error");
        inputLlmApiKey.focus();
        return;
      }
      if (!config.llmBaseUrl) {
        afficherStatut("Veuillez renseigner l'URL de base du serveur LLM.", "error");
        inputLlmBaseUrl.focus();
        return;
      }
    }

    if (provider === "libretranslate" && !config.libretranslateUrl) {
      afficherStatut("Veuillez renseigner l'URL de votre instance LibreTranslate.", "error");
      inputLibreTranslateUrl.focus();
      return;
    }

    // Demande de permission à la volée sur le geste utilisateur
    await assurerPermissionsHote(config);

    const nomFournisseur = selectProvider.selectedOptions[0] ? selectProvider.selectedOptions[0].text.split("(")[0].trim() : provider;
    afficherStatut(t("btnTesting", `Test de connexion en cours avec ${nomFournisseur}…`), "loading");
    btnTest.disabled = true;
    btnSave.disabled = true;

    try {
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

      const configAiguillee = {
        ...config,
        apiKey,
        url,
        model,
        preset: config.llmPreset,
        plan: config.deeplPlan
      };

      const reponse = await browser.runtime.sendMessage({
        action: "testProvider",
        config: configAiguillee
      });

      if (reponse && reponse.success) {
        afficherStatut(t("statusTestSuccess", "✓ Connexion réussie ! Le moteur fonctionne correctement."), "success");
      } else {
        const msg = (reponse && reponse.message) || "Échec de la connexion.";
        afficherStatut(`${t("statusTestError", "Échec du test :")} ${msg}`, "error");
      }
    } catch (err) {
      afficherStatut(`${t("errorGeneric", "Erreur :")} ${err.message || "Impossible de contacter le service."}`, "error");
    } finally {
      btnTest.disabled = false;
      btnSave.disabled = false;
    }
  });

  // ── Enregistrement des préférences ─────────────────────────────────────────
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const config = obtenirConfigFormulaire();

    // Demande de permission à la volée sur le geste utilisateur
    await assurerPermissionsHote(config);

    btnSave.disabled = true;
    btnTest.disabled = true;
    afficherStatut(t("btnSaving", "Enregistrement des préférences…"), "loading");

    try {
      await browser.storage.local.set(config);
      afficherStatut(t("statusSaved", "✓ Préférences enregistrées avec succès !"), "success");
    } catch (err) {
      console.error("[MagicTranslator Options] Erreur sauvegarde :", err);
      afficherStatut(`${t("errorGeneric", "Erreur lors de la sauvegarde :")} ${err.message}`, "error");
    } finally {
      btnSave.disabled = false;
      btnTest.disabled = false;
    }
  });
});
