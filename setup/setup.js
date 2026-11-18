/**
 * Magic Translator — Logique de l'assistant de premier lancement (setup.js)
 * ═════════════════════════════════════════════════════════════════════════
 * Gère le consentement explicite de l'utilisateur (Opt-In ATN) au premier
 * démarrage de l'extension :
 *   - Activation en 1 clic de Google Translate (avec option de relais MyMemory)
 *   - Ouverture de la page complète des paramètres pour les moteurs alternatifs
 */

"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const versionBadge = document.getElementById("setup-version-badge");
  const chkMyMemory = document.getElementById("chk-mymemory-fallback");
  const btnActivateGoogle = document.getElementById("btn-activate-google");
  const btnActivateGoogleLabel = document.getElementById("btn-activate-google-label");
  const btnOpenOptions = document.getElementById("btn-open-options");
  const statusBanner = document.getElementById("setup-status");
  const statusText = document.getElementById("setup-status-text");
  const btnCloseTab = document.getElementById("btn-close-tab");

  let activationEnCours = false;

  // ── 0. Badge de version dynamique depuis manifest.json ────────────────────
  try {
    const manifest = browser.runtime.getManifest();
    if (versionBadge && manifest && manifest.version) {
      versionBadge.textContent = `v${manifest.version}`;
    }
  } catch { /* ignore */ }

  // ── 1. Internationalisation (i18n) ────────────────────────────────────────
  function t(key, fallback = "", vars = null) {
    let texte = fallback;
    try {
      const msg = browser.i18n.getMessage(key);
      if (msg) texte = msg;
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

  const LOCALES_SUPPORTEES = new Set(["fr", "en", "de", "es", "vi", "ja", "pt"]);

  function appliquerI18n() {
    try {
      const lang = browser.i18n.getUILanguage ? browser.i18n.getUILanguage() : "en";
      const codePrimaire = lang.split("-")[0].toLowerCase();
      document.documentElement.lang = LOCALES_SUPPORTEES.has(codePrimaire) ? codePrimaire : "en";
    } catch { /* ignore */ }

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const msg = t(key);
      if (msg) {
        el.textContent = msg;
      }
    });
  }

  function afficherBanniereStatut(message, { type = "success", afficherFermer = true } = {}) {
    if (!statusBanner || !statusText) return;
    statusBanner.classList.remove("is-empty");
    statusBanner.classList.toggle("is-error", type === "error");
    statusText.textContent = message;
    if (btnCloseTab) {
      btnCloseTab.hidden = !afficherFermer;
    }
  }

  function masquerBanniereStatut() {
    if (!statusBanner || !statusText) return;
    statusBanner.classList.add("is-empty");
    statusBanner.classList.remove("is-error");
    statusText.textContent = "";
    if (btnCloseTab) {
      btnCloseTab.hidden = true;
    }
  }

  appliquerI18n();

  const NOMS_MOTEURS = {
    google: "Google Translate",
    mymemory: "MyMemory",
    deepl: "DeepL",
    gemini: "Google Gemini",
    llm: "LLMs Hub",
    libretranslate: "LibreTranslate"
  };

  async function synchroniserEtatAccueil() {
    let provider = "none";
    let enableMyMemoryFallback = false;

    try {
      const res = await browser.runtime.sendMessage({ action: "getConfig" });
      if (res && res.success) {
        provider = res.provider || "none";
        enableMyMemoryFallback = Boolean(res.enableMyMemoryFallback);
      } else {
        const stocke = await browser.storage.local.get(["provider", "enableMyMemoryFallback"]);
        provider = stocke.provider || "none";
        enableMyMemoryFallback = Boolean(stocke.enableMyMemoryFallback);
      }
    } catch {
      const stocke = await browser.storage.local.get(["provider", "enableMyMemoryFallback"]).catch(() => ({}));
      provider = stocke.provider || "none";
      enableMyMemoryFallback = Boolean(stocke.enableMyMemoryFallback);
    }

    if (chkMyMemory) {
      chkMyMemory.checked = enableMyMemoryFallback;
    }

    if (provider && provider !== "none") {
      const nomActif = NOMS_MOTEURS[provider] || provider;
      afficherBanniereStatut(
        t(
          "setupStatusAlreadyActive",
          "✓ Moteur actuellement actif : {provider}. Vous pouvez modifier votre choix ci-dessous ou fermer cet onglet.",
          { provider: nomActif }
        ),
        { type: "success", afficherFermer: true }
      );
      if (btnActivateGoogleLabel) {
        btnActivateGoogleLabel.textContent = (provider === "google")
          ? t("setupBtnActivatedGoogle", "✓ Google Translate activé (mettre à jour l'option)")
          : t("setupBtnActivateGoogle", "✓ Activer Google Translate et commencer");
      }
    } else {
      masquerBanniereStatut();
      if (btnActivateGoogleLabel) {
        btnActivateGoogleLabel.textContent = t("setupBtnActivateGoogle", "✓ Activer Google Translate et commencer");
      }
    }
  }

  // Marquer l'assistant présenté et synchroniser l'état courant
  try {
    await browser.storage.local.set({ onboardingShown: true });
    await synchroniserEtatAccueil();
  } catch (err) {
    console.warn("[MagicTranslator] Erreur synchronisation initiale setup :", err);
  }

  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changements, zone) => {
      if (zone !== "local") return;
      if (changements.provider || changements.enableMyMemoryFallback) {
        synchroniserEtatAccueil();
      }
    });
  }

  // ── 2. Activation en 1 clic de Google Translate (+ option MyMemory) ──────
  if (btnActivateGoogle) {
    btnActivateGoogle.addEventListener("click", async () => {
      if (activationEnCours) return;
      activationEnCours = true;
      btnActivateGoogle.disabled = true;

      const autoriserMyMemory = chkMyMemory ? Boolean(chkMyMemory.checked) : false;
      try {
        await browser.storage.local.set({
          provider: "google",
          enableMyMemoryFallback: autoriserMyMemory,
          onboardingShown: true
        });
        if (btnActivateGoogleLabel) {
          btnActivateGoogleLabel.textContent = t(
            "setupBtnActivatedGoogle",
            "✓ Google Translate activé (mettre à jour l'option)"
          );
        }
        afficherBanniereStatut(
          t(
            "setupStatusActivated",
            "✓ Google Translate est activé ! Vous pouvez maintenant fermer cet onglet et traduire vos e-mails."
          ),
          { type: "success", afficherFermer: true }
        );
        if (btnCloseTab) {
          const preferReduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          btnCloseTab.scrollIntoView({ behavior: preferReduce ? "auto" : "smooth", block: "nearest" });
          btnCloseTab.focus();
        }
      } catch (err) {
        console.error("[MagicTranslator] Erreur lors de l'activation :", err);
        afficherBanniereStatut(
          t("errorSavePreferences", "Impossible d'enregistrer les préférences."),
          { type: "error", afficherFermer: false }
        );
      } finally {
        activationEnCours = false;
        btnActivateGoogle.disabled = false;
      }
    });
  }

  // ── 3. Ouverture de la page complète des options ──────────────────────────
  if (btnOpenOptions) {
    btnOpenOptions.addEventListener("click", async () => {
      btnOpenOptions.disabled = true;
      try {
        await browser.storage.local.set({ onboardingShown: true });
        await browser.runtime.openOptionsPage();
      } catch (err) {
        console.error("[MagicTranslator] Impossible d'ouvrir les options :", err);
      } finally {
        btnOpenOptions.disabled = false;
      }
    });
  }

  // ── 4. Fermeture de l'onglet d'accueil ────────────────────────────────────
  if (btnCloseTab) {
    btnCloseTab.addEventListener("click", async () => {
      try {
        const ongletCourant = await browser.tabs.getCurrent();
        if (ongletCourant && ongletCourant.id) {
          await browser.tabs.remove(ongletCourant.id);
        } else {
          window.close();
        }
      } catch {
        window.close();
      }
    });
  }
});
