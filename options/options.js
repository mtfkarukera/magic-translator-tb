/**
 * Magic Translator — Script de la page d'options
 * ══════════════════════════════════════════════
 *
 * Gère le chargement, la validation stricte en direct et la persistance des préférences
 * dans browser.storage.local, avec support multilingue i18n natif (7 langues).
 */

"use strict";

/**
 * Récupère un message localisé depuis browser.i18n avec substitutions nommées optionnelles.
 * @param {string} cle - Clé de message
 * @param {string} [repli=""] - Texte de repli si la clé est absente
 * @param {Record<string, string|number>} [vars] - Variables de remplacement ({count}, {error}, etc.)
 * @returns {string}
 */
function t(cle, repli = "", vars = null) {
  let texte = repli;
  try {
    if (typeof browser !== "undefined" && browser.i18n && browser.i18n.getMessage) {
      const msg = browser.i18n.getMessage(cle);
      if (msg) texte = msg;
    }
  } catch {
    // Ignorer
  }
  if (vars && texte) {
    for (const [nom, val] of Object.entries(vars)) {
      texte = texte.replaceAll(`{${nom}}`, String(val));
    }
  }
  return texte;
}

/**
 * Parcourt le DOM et applique les traductions sur tous les éléments data-i18n*.
 */
function appliquerI18n() {
  const uiLang = browser.i18n ? browser.i18n.getUILanguage() : "en";
  if (uiLang) {
    document.documentElement.lang = uiLang.split("-")[0];
  }
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
  const btnOpenSetup = document.getElementById("btn-open-setup");

  const sectionGoogle = document.getElementById("section-google");
  const chkEnableMyMemoryFallback = document.getElementById("enable-mymemory-fallback");

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

  const sectionMyMemory = document.getElementById("section-mymemory");
  const inputMyMemoryEmail = document.getElementById("mymemory-email");

  const chkAutoTranslateOnClick = document.getElementById("auto-translate-on-click");
  const selectAlternateTarget = document.getElementById("select-alternate-target");

  const chkAutoTranslateOnOpen = document.getElementById("auto-translate-on-open");
  const zeroClickSuboptions = document.getElementById("zero-click-suboptions");
  const modeAllForeign = document.getElementById("mode-all-foreign");
  const modeSelected = document.getElementById("mode-selected");
  const zeroClickLangsGrid = document.getElementById("zero-click-langs-grid");
  const chkPreferLocalDetection = document.getElementById("prefer-local-detection");

  const warningBanner = document.getElementById("permission-warning-banner");
  const btnGrantPermission = document.getElementById("btn-grant-permission");
  const permissionProviderName = document.getElementById("permission-provider-name");
  const permissionDomainCode = document.getElementById("permission-domain-code");

  const statusContainer = document.getElementById("status-container");
  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");

  const btnTest = document.getElementById("btn-test");
  const btnSave = document.getElementById("btn-save");

  const CHAMPS_VALIDABLES = [
    inputDeeplKey,
    inputGeminiKey,
    inputLlmBaseUrl,
    inputLlmApiKey,
    inputLlmModel,
    inputLibreTranslateUrl
  ].filter(Boolean);

  // Garde synchrone anti-réentrance sur Enregistrer / Tester
  let actionEnCours = false;

  // ── Valeurs par défaut & Presets LLM ───────────────────────────────────────
  const DEFAUTS = {
    provider: "none",
    enableMyMemoryFallback: false,
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
    autoTranslateOnOpen: false,
    autoTranslateMode: "all_foreign",
    autoTranslateLangs: [],
    preferLocalDetection: false
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
      keyPlaceholder: t("placeholderLlmApiKey", "Laisser vide si aucune clé requise (local)"),
      requiresKey: false
    },
    lmstudio: {
      url: "http://localhost:1234",
      model: "local-model",
      keyPlaceholder: t("placeholderLlmApiKey", "Laisser vide si aucune clé requise (local)"),
      requiresKey: false
    },
    custom: {
      url: "",
      model: "",
      keyPlaceholder: t("placeholderLlmApiKey", "Laisser vide si aucune clé requise"),
      requiresKey: false
    }
  };

  /**
   * Efface les indicateurs d'erreur sur les champs du formulaire.
   */
  function effacerErreursValidation() {
    CHAMPS_VALIDABLES.forEach((champ) => champ.removeAttribute("aria-invalid"));
  }

  CHAMPS_VALIDABLES.forEach((champ) => {
    champ.addEventListener("input", () => {
      champ.removeAttribute("aria-invalid");
    });
  });

  /**
   * Affiche un message d'état dans le conteneur de statut ARIA.
   * @param {string} texte - Message à afficher
   * @param {'success'|'error'|'loading'} type - Type d'état
   */
  function afficherStatut(texte, type) {
    statusContainer.className = `mt-status-container mt-status-${type}`;

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
   * Masque visuellement le conteneur de statut tout en le gardant monté dans l'arbre ARIA.
   */
  function masquerStatut() {
    statusContainer.className = "mt-status-container is-empty";
    statusIcon.textContent = "";
    statusText.textContent = "";
  }

  /**
   * Synchronise l'état visuel et ARIA des sous-options Zéro-Clic.
   */
  function synchroniserEtatZeroClic() {
    const ouvert = Boolean(chkAutoTranslateOnOpen && chkAutoTranslateOnOpen.checked);
    if (chkAutoTranslateOnOpen) {
      chkAutoTranslateOnOpen.setAttribute("aria-expanded", String(ouvert));
    }
    if (zeroClickSuboptions) {
      zeroClickSuboptions.classList.toggle("mt-hidden", !ouvert);
    }
  }

  /**
   * S'assure qu'une option existe dans le sélecteur de modèles Gemini avant de la sélectionner.
   * @param {string} modelId
   */
  function definirModeleGeminiSelectionne(modelId) {
    if (!selectGeminiModel || !modelId) return;
    const existe = Array.from(selectGeminiModel.options).some((opt) => opt.value === modelId);
    if (!existe) {
      const opt = document.createElement("option");
      opt.value = modelId;
      opt.textContent = modelId;
      selectGeminiModel.appendChild(opt);
    }
    selectGeminiModel.value = modelId;
  }

  /**
   * Met à jour la visibilité des sections en fonction du moteur sélectionné.
   */
  function actualiserAffichageFournisseur() {
    const provider = selectProvider.value;

    if (sectionGoogle) sectionGoogle.classList.add("mt-hidden");
    sectionDeepl.classList.add("mt-hidden");
    sectionGemini.classList.add("mt-hidden");
    sectionLlm.classList.add("mt-hidden");
    sectionLibreTranslate.classList.add("mt-hidden");
    sectionMyMemory.classList.add("mt-hidden");

    if (provider === "none") {
      providerBadge.textContent = t("badgeUnconfigured", "Non configuré");
      helpProvider.textContent = t("helpProviderNone", "Aucun fournisseur n'est activé par défaut. Sélectionnez un moteur ci-dessus et enregistrez vos préférences.");
    } else if (provider === "google") {
      if (sectionGoogle) sectionGoogle.classList.remove("mt-hidden");
      providerBadge.textContent = "Google";
      helpProvider.textContent = t("helpProviderGoogle", "Google Translate fonctionne immédiatement sans aucune clé d'API ni configuration.");
    } else if (provider === "mymemory") {
      sectionMyMemory.classList.remove("mt-hidden");
      providerBadge.textContent = "MyMemory";
      helpProvider.textContent = t("helpProviderMyMemory", "Traduction gratuite via MyMemory (Translated.net) sans clé requise.");
    } else if (provider === "deepl") {
      sectionDeepl.classList.remove("mt-hidden");
      providerBadge.textContent = "DeepL";
      helpProvider.textContent = `${t("helpDeeplKey", "DeepL API")} (https://www.deepl.com/pro-api)`;
    } else if (provider === "gemini") {
      sectionGemini.classList.remove("mt-hidden");
      providerBadge.textContent = "Gemini API";
      helpProvider.textContent = t("helpGeminiModels", "Google Gemini API");
    } else if (provider === "llm") {
      sectionLlm.classList.remove("mt-hidden");
      providerBadge.textContent = "LLMs Hub";
      helpProvider.textContent = t("helpLlmBaseUrl", "OpenAI, Groq, Mistral, Ollama, LM Studio");
    } else if (provider === "libretranslate") {
      sectionLibreTranslate.classList.remove("mt-hidden");
      providerBadge.textContent = "LibreTranslate";
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
      if (!silencieux) {
        inputGeminiKey.setAttribute("aria-invalid", "true");
        inputGeminiKey.focus();
        afficherStatut(t("errorKeyRequired", "Une clé d'API est requise pour ce fournisseur."), "error");
      }
      return;
    }

    const libelleRepos = t("btnRefreshModels", "🔄 Actualiser les modèles");
    if (btnRefreshGeminiModels) {
      btnRefreshGeminiModels.disabled = true;
      btnRefreshGeminiModels.textContent = t("btnRefreshingModels", "⏳ Chargement…");
    }

    // Demande de permission sous geste utilisateur uniquement (clic explicite)
    if (!silencieux) {
      const accorde = await assurerPermissionsHote({ provider: "gemini", geminiApiKey: apiKey });
      if (!accorde) {
        if (btnRefreshGeminiModels) {
          btnRefreshGeminiModels.disabled = false;
          btnRefreshGeminiModels.textContent = libelleRepos;
        }
        await verifierPermissionMoteur();
        afficherStatut(t("errorPermissionDenied", "Autorisation réseau refusée. Accordez l'accès au domaine pour continuer."), "error");
        return;
      }
    }

    try {
      const reponse = await browser.runtime.sendMessage({
        action: "listGeminiModels",
        apiKey: apiKey.trim()
      });

      if (reponse && reponse.success && Array.isArray(reponse.models) && reponse.models.length > 0) {
        const valeurActuelle = selectGeminiModel.value;
        selectGeminiModel.replaceChildren();

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
        } else if (valeurActuelle) {
          // Conserve le modèle enregistré si non retourné dans la liste courante
          definirModeleGeminiSelectionne(valeurActuelle);
        } else if (optionFlashLite) {
          selectGeminiModel.value = optionFlashLite;
        } else if (selectGeminiModel.options.length > 0) {
          selectGeminiModel.selectedIndex = 0;
        }

        if (helpGeminiModels) {
          helpGeminiModels.textContent = t(
            "helpGeminiModelsSynced",
            "✓ {count} modèles disponibles synchronisés avec Google AI Studio.",
            { count: reponse.models.length }
          );
        }

        if (!silencieux) {
          afficherStatut(
            t(
              "statusGeminiModelsSynced",
              "✓ {count} modèles Gemini synchronisés avec succès !",
              { count: reponse.models.length }
            ),
            "success"
          );
        }
      } else {
        const err = (reponse && reponse.message) || "HTTP";
        if (helpGeminiModels) {
          helpGeminiModels.textContent = t(
            "errorGeminiModelsSync",
            "⚠️ Erreur de synchronisation : {error}",
            { error: err }
          );
        }
        if (!silencieux) {
          afficherStatut(
            t("errorGeminiModelsSync", "⚠️ Erreur de synchronisation : {error}", { error: err }),
            "error"
          );
        }
      }
    } catch (err) {
      const msg = (err && err.message) || "Network error";
      if (helpGeminiModels) {
        helpGeminiModels.textContent = t("errorGeminiModelsSync", "⚠️ Erreur de synchronisation : {error}", { error: msg });
      }
      if (!silencieux) {
        afficherStatut(t("errorGeminiModelsSync", "⚠️ Erreur de synchronisation : {error}", { error: msg }), "error");
      }
    } finally {
      if (btnRefreshGeminiModels) {
        btnRefreshGeminiModels.disabled = false;
        btnRefreshGeminiModels.textContent = libelleRepos;
      }
    }
  }

  // ── Chargement initial des réglages ────────────────────────────────────────
  try {
    const stocke = await browser.storage.local.get(Object.keys(DEFAUTS));
    const config = { ...DEFAUTS, ...stocke };

    selectProvider.value = config.provider;
    if (chkEnableMyMemoryFallback) {
      chkEnableMyMemoryFallback.checked = Boolean(config.enableMyMemoryFallback);
    }
    inputDeeplKey.value = config.deeplApiKey;
    selectDeeplPlan.value = config.deeplPlan;

    inputGeminiKey.value = config.geminiApiKey;
    definirModeleGeminiSelectionne(config.geminiModel || "gemini-3.5-flash-lite");

    selectLlmPreset.value = config.llmPreset || "openai";
    inputLlmBaseUrl.value = config.llmBaseUrl || "https://api.openai.com";
    inputLlmApiKey.value = config.llmApiKey;
    inputLlmModel.value = config.llmModel || "gpt-4o-mini";

    inputLibreTranslateUrl.value = config.libretranslateUrl || "https://libretranslate.com";
    inputLibreTranslateKey.value = config.libretranslateApiKey;
    inputMyMemoryEmail.value = config.mymemoryEmail || "";

    chkAutoTranslateOnOpen.checked = Boolean(config.autoTranslateOnOpen);
    // Exclusion mutuelle au chargement : si Zéro-Clic est actif, désactive le 1-Clic
    if (chkAutoTranslateOnOpen.checked) {
      chkAutoTranslateOnClick.checked = false;
    } else {
      chkAutoTranslateOnClick.checked = Boolean(config.autoTranslateOnClick);
    }
    synchroniserEtatZeroClic();

    selectAlternateTarget.value = config.alternateTarget || "none";

    if (config.autoTranslateMode === "selected") {
      modeSelected.checked = true;
      zeroClickLangsGrid.classList.remove("mt-hidden");
    } else {
      modeAllForeign.checked = true;
      zeroClickLangsGrid.classList.add("mt-hidden");
    }

    const langsSelectionnees = new Set(Array.isArray(config.autoTranslateLangs) ? config.autoTranslateLangs : []);
    document.querySelectorAll(".mt-lang-chk").forEach((chk) => {
      chk.checked = langsSelectionnees.has(chk.value);
    });

    chkPreferLocalDetection.checked = Boolean(config.preferLocalDetection);

    actualiserAffichageFournisseur();

    // Vérification dynamique et conditionnelle de la permission pour le moteur actif
    await verifierPermissionMoteur();

    // Synchronisation silencieuse des modèles UNIQUEMENT si Gemini est le moteur actif
    if (config.provider === "gemini" && config.geminiApiKey) {
      actualiserModelesGemini(config.geminiApiKey, true);
    }
  } catch (err) {
    console.error("[MagicTranslator Options] Erreur de chargement :", err);
    afficherStatut(t("errorLoadPreferences", "Impossible de charger les préférences."), "error");
  }

  // ── Événements de changement de fournisseur ─────────────────────────────────
  selectProvider.addEventListener("change", () => {
    effacerErreursValidation();
    actualiserAffichageFournisseur();
    masquerStatut();
    verifierPermissionMoteur();
  });

  selectDeeplPlan.addEventListener("change", () => {
    verifierPermissionMoteur();
  });

  inputLibreTranslateUrl.addEventListener("input", () => {
    verifierPermissionMoteur();
  });

  // ── Événements Gemini ───────────────────────────────────────────────────────
  if (btnRefreshGeminiModels) {
    btnRefreshGeminiModels.addEventListener("click", () => {
      actualiserModelesGemini(inputGeminiKey.value.trim(), false);
    });
  }

  inputGeminiKey.addEventListener("blur", () => {
    if (selectProvider.value === "gemini" && inputGeminiKey.value.trim()) {
      actualiserModelesGemini(inputGeminiKey.value.trim(), true);
    }
    verifierPermissionMoteur();
  });

  // ── Changement de preset LLM ────────────────────────────────────────────────
  selectLlmPreset.addEventListener("change", () => {
    effacerErreursValidation();
    const preset = selectLlmPreset.value;
    const info = LLM_PRESETS[preset];
    if (info && preset !== "custom") {
      inputLlmBaseUrl.value = info.url;
      inputLlmModel.value = info.model;
      inputLlmApiKey.placeholder = info.keyPlaceholder;
    }
    masquerStatut();
    verifierPermissionMoteur();
  });

  inputLlmBaseUrl.addEventListener("input", () => {
    verifierPermissionMoteur();
  });

  // ── Événements Ergonomie : Bascule Mutuelle & Sous-options Zéro-Clic ────────
  if (chkAutoTranslateOnOpen) {
    chkAutoTranslateOnOpen.addEventListener("change", () => {
      if (chkAutoTranslateOnOpen.checked && chkAutoTranslateOnClick) {
        chkAutoTranslateOnClick.checked = false;
      }
      synchroniserEtatZeroClic();
    });
  }

  if (chkAutoTranslateOnClick) {
    chkAutoTranslateOnClick.addEventListener("change", () => {
      if (chkAutoTranslateOnClick.checked && chkAutoTranslateOnOpen) {
        chkAutoTranslateOnOpen.checked = false;
        synchroniserEtatZeroClic();
      }
    });
  }

  if (modeAllForeign) {
    modeAllForeign.addEventListener("change", () => {
      if (modeAllForeign.checked) {
        zeroClickLangsGrid.classList.add("mt-hidden");
      }
    });
  }

  if (modeSelected) {
    modeSelected.addEventListener("change", () => {
      if (modeSelected.checked) {
        zeroClickLangsGrid.classList.remove("mt-hidden");
        const checked = zeroClickLangsGrid.querySelectorAll(".mt-lang-chk:checked");
        if (checked.length === 0) {
          ["en", "de", "es"].forEach((code) => {
            const chk = zeroClickLangsGrid.querySelector(`.mt-lang-chk[value="${code}"]`);
            if (chk) chk.checked = true;
          });
        }
      }
    });
  }

  // ── Bouton 1-Clic d'Autorisation de Permission ──────────────────────────────
  if (btnGrantPermission) {
    btnGrantPermission.addEventListener("click", async () => {
      const config = obtenirConfigFormulaire();
      const pattern = globalThis.MTProviders ? globalThis.MTProviders.obtenirPatternOrigine(config.provider, config) : "";
      if (!pattern) return;

      try {
        if (browser.permissions && browser.permissions.request) {
          const accorde = await browser.permissions.request({ origins: [pattern] });
          if (accorde) {
            warningBanner.classList.add("mt-hidden");
            afficherStatut(t("statusPermissionGranted", "✓ Autorisation accordée avec succès ! Le moteur est prêt."), "success");
          } else {
            afficherStatut(t("errorPermissionDenied", "Autorisation réseau refusée. Accordez l'accès au domaine pour continuer."), "error");
          }
        }
      } catch (err) {
        console.error("[MagicTranslator Options] Erreur autorisation 1-clic :", err);
        afficherStatut(t("errorPermissionDenied", "Autorisation réseau refusée. Accordez l'accès au domaine pour continuer."), "error");
      }
    });
  }

  // ── Bascules Afficher / Masquer Mot de passe ────────────────────────────────
  function configurerBasculeMotDePasse(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
      const afficherCle = input.type === "password";
      input.type = afficherCle ? "text" : "password";
      btn.textContent = afficherCle ? "🔒" : "👁️";
      btn.setAttribute("aria-pressed", String(afficherCle));
      btn.setAttribute(
        "aria-label",
        afficherCle
          ? t("ariaHideKey", "Masquer la clé d'API")
          : t("ariaShowKey", "Afficher la clé d'API")
      );
    });
  }

  configurerBasculeMotDePasse(btnToggleDeeplKey, inputDeeplKey);
  configurerBasculeMotDePasse(btnToggleGeminiKey, inputGeminiKey);
  configurerBasculeMotDePasse(btnToggleLlmKey, inputLlmApiKey);
  configurerBasculeMotDePasse(btnToggleLtKey, inputLibreTranslateKey);

  if (btnOpenSetup) {
    btnOpenSetup.addEventListener("click", () => {
      browser.runtime.sendMessage({ action: "openSetup" }).catch(() => {});
    });
  }

  /**
   * Vérifie dynamiquement l'état de permission du moteur sélectionné.
   */
  async function verifierPermissionMoteur() {
    if (!warningBanner) return;

    const config = obtenirConfigFormulaire();
    const provider = config.provider;

    if (provider === "none") {
      warningBanner.classList.add("mt-hidden");
      return;
    }

    try {
      const pattern = globalThis.MTProviders ? globalThis.MTProviders.obtenirPatternOrigine(provider, config) : "";
      if (!pattern) {
        warningBanner.classList.add("mt-hidden");
        return;
      }

      if (browser.permissions && browser.permissions.contains) {
        const hasPermission = await browser.permissions.contains({ origins: [pattern] });
        if (hasPermission) {
          warningBanner.classList.add("mt-hidden");
          return;
        }

        const labelMap = {
          google: "Google Translate",
          mymemory: "MyMemory",
          deepl: "DeepL",
          gemini: "Google Gemini",
          llm: "Hub LLM",
          libretranslate: "LibreTranslate"
        };
        const nomMoteur = labelMap[provider] || provider;
        if (permissionProviderName) permissionProviderName.textContent = nomMoteur;

        const domaine = pattern.replace(/^\*:\/\//, "").replace(/^https?:\/\//, "").replace(/\/\*$/, "");
        if (permissionDomainCode) permissionDomainCode.textContent = domaine;

        warningBanner.classList.remove("mt-hidden");
      }
    } catch (err) {
      console.warn("[MagicTranslator Options] Erreur vérification permission :", err);
      warningBanner.classList.add("mt-hidden");
    }
  }

  /**
   * Construit l'objet de configuration actuel depuis le formulaire.
   * @returns {Object}
   */
  function obtenirConfigFormulaire() {
    const langsSelectionnees = [];
    document.querySelectorAll(".mt-lang-chk:checked").forEach((chk) => {
      langsSelectionnees.push(chk.value);
    });

    return {
      provider: selectProvider.value,
      enableMyMemoryFallback: chkEnableMyMemoryFallback ? chkEnableMyMemoryFallback.checked : false,
      deeplApiKey: inputDeeplKey.value.trim(),
      deeplPlan: selectDeeplPlan.value,
      geminiApiKey: inputGeminiKey.value.trim(),
      geminiModel: selectGeminiModel.value,
      llmPreset: selectLlmPreset.value,
      llmBaseUrl: inputLlmBaseUrl.value.trim(),
      llmApiKey: inputLlmApiKey.value.trim(),
      llmModel: inputLlmModel.value.trim(),
      libretranslateUrl: inputLibreTranslateUrl.value.trim(),
      libretranslateApiKey: inputLibreTranslateKey.value.trim(),
      mymemoryEmail: inputMyMemoryEmail.value.trim(),
      autoTranslateOnClick: chkAutoTranslateOnClick.checked,
      alternateTarget: selectAlternateTarget.value,
      autoTranslateOnOpen: chkAutoTranslateOnOpen.checked,
      autoTranslateMode: modeSelected.checked ? "selected" : "all_foreign",
      autoTranslateLangs: langsSelectionnees,
      preferLocalDetection: chkPreferLocalDetection.checked
    };
  }

  /**
   * Vérifie et demande les permissions d'accès au domaine du fournisseur si nécessaire.
   * Politique fail-closed : retourne false si refusée ou en erreur.
   * @param {Object} config
   * @returns {Promise<boolean>}
   */
  async function assurerPermissionsHote(config) {
    if (!config || !config.provider || config.provider === "none") return true;
    const pattern = globalThis.MTProviders ? globalThis.MTProviders.obtenirPatternOrigine(config.provider, config) : "";
    if (!pattern) return true;
    try {
      if (browser.permissions && browser.permissions.request) {
        const accorde = await browser.permissions.request({ origins: [pattern] });
        return Boolean(accorde);
      }
      return true;
    } catch (err) {
      console.warn("[MagicTranslator Options] Demande de permissions échouée :", err);
      return false;
    }
  }

  /**
   * Valide que l'URL personnalisée respecte l'exigence HTTPS hors localhost de Mozilla Thunderbird.
   * @param {Object} config
   * @returns {boolean}
   */
  function validerSecuriteUrlFormulaire(config) {
    if (!globalThis.MTProviders || !globalThis.MTProviders.validerUrlSecurisee) return true;
    if (config.provider === "llm" && config.llmBaseUrl) {
      const val = globalThis.MTProviders.validerUrlSecurisee(config.llmBaseUrl);
      if (!val.valide) {
        inputLlmBaseUrl.setAttribute("aria-invalid", "true");
        afficherStatut(
          val.erreur === "CLEARTEXT_FORBIDDEN"
            ? t("errorCleartextForbidden", "Connexion HTTP non chiffrée refusée : conformément à la politique de sécurité de Mozilla Thunderbird, HTTPS est obligatoire hors de localhost / 127.0.0.1.")
            : t("errorInvalidUrl", "L'URL saisie est invalide."),
          "error"
        );
        inputLlmBaseUrl.focus();
        return false;
      }
    }
    if (config.provider === "libretranslate" && config.libretranslateUrl) {
      const val = globalThis.MTProviders.validerUrlSecurisee(config.libretranslateUrl);
      if (!val.valide) {
        inputLibreTranslateUrl.setAttribute("aria-invalid", "true");
        afficherStatut(
          val.erreur === "CLEARTEXT_FORBIDDEN"
            ? t("errorCleartextForbidden", "Connexion HTTP non chiffrée refusée : conformément à la politique de sécurité de Mozilla Thunderbird, HTTPS est obligatoire hors de localhost / 127.0.0.1.")
            : t("errorInvalidUrl", "L'URL saisie est invalide."),
          "error"
        );
        inputLibreTranslateUrl.focus();
        return false;
      }
    }
    return true;
  }

  /**
   * Valide l'intégralité des champs requis pour le fournisseur sélectionné.
   * @param {Object} config
   * @param {boolean} [exigerFournisseur=false]
   * @returns {boolean}
   */
  function validerChampsFormulaire(config, exigerFournisseur = false) {
    effacerErreursValidation();
    const provider = config.provider;

    if (provider === "none") {
      if (exigerFournisseur) {
        afficherStatut(t("errorTestProviderNone", "Veuillez d'abord sélectionner un fournisseur de traduction à tester."), "error");
        selectProvider.focus();
        return false;
      }
      return true;
    }

    if (provider === "deepl" && !config.deeplApiKey) {
      inputDeeplKey.setAttribute("aria-invalid", "true");
      afficherStatut(t("errorKeyRequired", "Une clé d'API est requise pour ce fournisseur."), "error");
      inputDeeplKey.focus();
      return false;
    }

    if (provider === "gemini" && !config.geminiApiKey) {
      inputGeminiKey.setAttribute("aria-invalid", "true");
      afficherStatut(t("errorKeyRequired", "Une clé d'API est requise pour ce fournisseur."), "error");
      inputGeminiKey.focus();
      return false;
    }

    if (provider === "llm") {
      const preset = config.llmPreset;
      const exigeCle = preset === "openai" || preset === "groq" || preset === "mistral";
      if (!config.llmBaseUrl) {
        inputLlmBaseUrl.setAttribute("aria-invalid", "true");
        afficherStatut(t("errorUrlRequired", "L'URL du serveur est requise."), "error");
        inputLlmBaseUrl.focus();
        return false;
      }
      if (exigeCle && !config.llmApiKey) {
        inputLlmApiKey.setAttribute("aria-invalid", "true");
        afficherStatut(t("errorKeyRequired", "Une clé d'API est requise pour ce fournisseur."), "error");
        inputLlmApiKey.focus();
        return false;
      }
      if (!config.llmModel) {
        inputLlmModel.setAttribute("aria-invalid", "true");
        afficherStatut(t("errorModelRequired", "L'identifiant du modèle est requis."), "error");
        inputLlmModel.focus();
        return false;
      }
    }

    if (provider === "libretranslate" && !config.libretranslateUrl) {
      inputLibreTranslateUrl.setAttribute("aria-invalid", "true");
      afficherStatut(t("errorUrlRequired", "L'URL du serveur est requise."), "error");
      inputLibreTranslateUrl.focus();
      return false;
    }

    return validerSecuriteUrlFormulaire(config);
  }

  // ── Test de connexion en direct ────────────────────────────────────────────
  btnTest.addEventListener("click", async () => {
    if (actionEnCours) return;

    const config = obtenirConfigFormulaire();
    if (!validerChampsFormulaire(config, true)) {
      return;
    }

    actionEnCours = true;
    btnTest.disabled = true;
    btnSave.disabled = true;

    try {
      // Demande de permission à la volée sur le geste utilisateur
      const accorde = await assurerPermissionsHote(config);
      await verifierPermissionMoteur();
      if (!accorde) {
        afficherStatut(t("errorPermissionDenied", "Autorisation réseau refusée. Accordez l'accès au domaine pour continuer."), "error");
        return;
      }

      afficherStatut(t("btnTesting", "Test en cours…"), "loading");

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
        afficherStatut(`✓ ${t("statusTestSuccess", "Connexion réussie !")}`, "success");
      } else {
        const msg = (reponse && reponse.message) || "HTTP";
        afficherStatut(`${t("statusTestError", "Échec de la connexion :")} ${msg}`, "error");
      }
    } catch (err) {
      afficherStatut(
        `${t("statusTestError", "Échec de la connexion :")} ${(err && err.message) || "Network error"}`,
        "error"
      );
    } finally {
      actionEnCours = false;
      btnTest.disabled = false;
      btnSave.disabled = false;
    }
  });

  // ── Enregistrement des préférences ─────────────────────────────────────────
  const enregistrerPreferences = async (e) => {
    if (e) e.preventDefault();
    if (actionEnCours) return;

    const config = obtenirConfigFormulaire();
    if (!validerChampsFormulaire(config, false)) {
      return;
    }

    actionEnCours = true;
    btnSave.disabled = true;
    btnTest.disabled = true;

    try {
      // Demande de permission à la volée sur le geste utilisateur direct
      const accorde = await assurerPermissionsHote(config);
      await verifierPermissionMoteur();
      if (!accorde) {
        afficherStatut(t("errorPermissionDenied", "Autorisation réseau refusée. Accordez l'accès au domaine pour continuer."), "error");
        return;
      }

      afficherStatut(t("btnSaving", "Enregistrement…"), "loading");
      await browser.storage.local.set({ ...config, onboardingShown: true });
      afficherStatut(`✓ ${t("statusSaved", "Préférences enregistrées avec succès !")}`, "success");
    } catch (err) {
      console.error("[MagicTranslator Options] Erreur sauvegarde :", err);
      afficherStatut(
        `${t("statusTestError", "Échec :")} ${(err && err.message) || "Storage error"}`,
        "error"
      );
    } finally {
      actionEnCours = false;
      btnSave.disabled = false;
      btnTest.disabled = false;
    }
  };

  form.addEventListener("submit", enregistrerPreferences);
});
