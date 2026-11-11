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

  function appliquerI18n() {
    try {
      const lang = browser.i18n.getUILanguage ? browser.i18n.getUILanguage() : "fr";
      document.documentElement.lang = lang.split("-")[0] || "fr";
    } catch { /* ignore */ }

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const msg = t(key);
      if (msg) {
        el.textContent = msg;
      }
    });
  }

  function afficherBanniereStatut(message) {
    if (!statusBanner || !statusText) return;
    statusBanner.classList.remove("is-empty");
    statusText.textContent = message;
    if (btnCloseTab) {
      btnCloseTab.hidden = false;
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

  // Marquer que l'assistant a été présenté et refléter un moteur déjà actif
  try {
    await browser.storage.local.set({ onboardingShown: true });
    const stocke = await browser.storage.local.get(["provider", "enableMyMemoryFallback"]);
    if (typeof stocke.enableMyMemoryFallback === "boolean" && chkMyMemory) {
      chkMyMemory.checked = stocke.enableMyMemoryFallback;
    }
    if (stocke.provider && stocke.provider !== "none") {
      const nomActif = NOMS_MOTEURS[stocke.provider] || stocke.provider;
      afficherBanniereStatut(
        t(
          "setupStatusAlreadyActive",
          "✓ Moteur actuellement actif : {provider}. Vous pouvez modifier votre choix ci-dessous ou fermer cet onglet.",
          { provider: nomActif }
        )
      );
      if (stocke.provider === "google" && btnActivateGoogleLabel) {
        btnActivateGoogleLabel.textContent = t(
          "setupBtnActivatedGoogle",
          "✓ Google Translate activé (mettre à jour l'option)"
        );
      }
    }
  } catch { /* ignore */ }

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
          )
        );
        if (btnCloseTab) {
          btnCloseTab.scrollIntoView({ behavior: "smooth", block: "nearest" });
          btnCloseTab.focus();
        }
      } catch (err) {
        console.error("[MagicTranslator] Erreur lors de l'activation :", err);
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
