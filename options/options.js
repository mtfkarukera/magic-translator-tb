/**
 * Magic Translator — Script de la page d'options
 * ══════════════════════════════════════════════
 *
 * Gère le chargement, la validation en direct et la persistance des préférences
 * dans browser.storage.local.
 */

"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  // ── Éléments du DOM ────────────────────────────────────────────────────────
  const form = document.getElementById("form-options");
  const selectProvider = document.getElementById("select-provider");
  const providerBadge = document.getElementById("provider-badge");
  const helpProvider = document.getElementById("help-provider");

  const sectionDeepl = document.getElementById("section-deepl");
  const inputDeeplKey = document.getElementById("deepl-api-key");
  const selectDeeplPlan = document.getElementById("deepl-plan");
  const btnToggleDeeplKey = document.getElementById("btn-toggle-deepl-key");

  const sectionLibreTranslate = document.getElementById("section-libretranslate");
  const inputLibreTranslateUrl = document.getElementById("libretranslate-url");
  const inputLibreTranslateKey = document.getElementById("libretranslate-api-key");
  const btnToggleLtKey = document.getElementById("btn-toggle-lt-key");

  const statusContainer = document.getElementById("status-container");
  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");

  const btnTest = document.getElementById("btn-test");
  const btnSave = document.getElementById("btn-save");

  // ── Valeurs par défaut ─────────────────────────────────────────────────────
  const DEFAUTS = {
    provider: "google",
    deeplApiKey: "",
    deeplPlan: "auto",
    libretranslateUrl: "https://libretranslate.com",
    libretranslateApiKey: ""
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
    sectionLibreTranslate.classList.add("mt-hidden");

    if (provider === "google") {
      providerBadge.textContent = "Par défaut";
      providerBadge.style.display = "inline-block";
      helpProvider.textContent = "Google Translate fonctionne immédiatement sans aucune clé d'API ni configuration.";
    } else if (provider === "deepl") {
      sectionDeepl.classList.remove("mt-hidden");
      providerBadge.textContent = "Clé requise";
      providerBadge.style.display = "inline-block";
      helpProvider.textContent = "DeepL offre une fidélité linguistique reconnue et le respect des nuances formelles.";
    } else if (provider === "libretranslate") {
      sectionLibreTranslate.classList.remove("mt-hidden");
      providerBadge.textContent = "Auto-hébergé / Public";
      providerBadge.style.display = "inline-block";
      helpProvider.textContent = "LibreTranslate permet la traduction souveraine sur votre propre serveur ou une instance ouverte.";
    }
  }

  // ── Chargement initial des réglages ────────────────────────────────────────
  try {
    const stocke = await browser.storage.local.get(Object.keys(DEFAUTS));
    const config = { ...DEFAUTS, ...stocke };

    selectProvider.value = config.provider;
    inputDeeplKey.value = config.deeplApiKey;
    selectDeeplPlan.value = config.deeplPlan;
    inputLibreTranslateUrl.value = config.libretranslateUrl || "https://libretranslate.com";
    inputLibreTranslateKey.value = config.libretranslateApiKey;

    actualiserAffichageFournisseur();
  } catch (err) {
    console.error("[MagicTranslator Options] Erreur de chargement :", err);
    afficherStatut("Impossible de charger les préférences.", "error");
  }

  // ── Événements de changement de fournisseur ─────────────────────────────────
  selectProvider.addEventListener("change", () => {
    actualiserAffichageFournisseur();
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

    if (provider === "libretranslate" && !config.libretranslateUrl) {
      afficherStatut("Veuillez renseigner l'URL de votre instance LibreTranslate.", "error");
      inputLibreTranslateUrl.focus();
      return;
    }

    // Demande de permission à la volée sur le geste utilisateur
    await assurerPermissionsHote(config);

    afficherStatut(`Test de connexion en cours avec ${selectProvider.selectedOptions[0].text.split("(")[0].trim()}…`, "loading");
    btnTest.disabled = true;
    btnSave.disabled = true;

    try {
      const configAiguillee = {
        provider: config.provider,
        apiKey: config.provider === "deepl" ? config.deeplApiKey : config.libretranslateApiKey,
        plan: config.deeplPlan,
        url: config.libretranslateUrl
      };

      const reponse = await browser.runtime.sendMessage({
        action: "testProvider",
        config: configAiguillee
      });

      if (reponse && reponse.success) {
        afficherStatut("✓ Connexion réussie ! Le moteur fonctionne correctement.", "success");
      } else {
        const msg = (reponse && reponse.message) || "Échec de la connexion.";
        afficherStatut(`Échec du test : ${msg}`, "error");
      }
    } catch (err) {
      afficherStatut(`Erreur : ${err.message || "Impossible de contacter le service."}`, "error");
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
    afficherStatut("Enregistrement des préférences…", "loading");

    try {
      await browser.storage.local.set(config);
      afficherStatut("✓ Préférences enregistrées avec succès !", "success");
    } catch (err) {
      console.error("[MagicTranslator Options] Erreur sauvegarde :", err);
      afficherStatut(`Erreur lors de la sauvegarde : ${err.message}`, "error");
    } finally {
      btnSave.disabled = false;
      btnTest.disabled = false;
    }
  });
});
