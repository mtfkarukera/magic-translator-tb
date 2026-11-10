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
  const chkMyMemory = document.getElementById("chk-mymemory-fallback");
  const btnActivateGoogle = document.getElementById("btn-activate-google");
  const btnOpenOptions = document.getElementById("btn-open-options");
  const statusBanner = document.getElementById("setup-status");
  const statusText = document.getElementById("setup-status-text");
  const btnCloseTab = document.getElementById("btn-close-tab");

  // ── 1. Internationalisation (i18n) ────────────────────────────────────────
  function t(key, fallback = "") {
    try {
      const msg = browser.i18n.getMessage(key);
      return msg || fallback;
    } catch {
      return fallback;
    }
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

  appliquerI18n();

  // Marquer que l'assistant a été présenté à l'utilisateur
  try {
    await browser.storage.local.set({ onboardingShown: true });
    const stocke = await browser.storage.local.get(["provider", "enableMyMemoryFallback"]);
    if (typeof stocke.enableMyMemoryFallback === "boolean" && chkMyMemory) {
      chkMyMemory.checked = stocke.enableMyMemoryFallback;
    }
  } catch { /* ignore */ }

  // ── 2. Activation en 1 clic de Google Translate (+ option MyMemory) ──────
  if (btnActivateGoogle) {
    btnActivateGoogle.addEventListener("click", async () => {
      const autoriserMyMemory = chkMyMemory ? Boolean(chkMyMemory.checked) : true;
      try {
        await browser.storage.local.set({
          provider: "google",
          enableMyMemoryFallback: autoriserMyMemory,
          onboardingShown: true
        });
        if (statusText && statusBanner) {
          statusText.textContent = t(
            "setupStatusActivated",
            "✓ Google Translate est activé ! Vous pouvez maintenant fermer cet onglet et traduire vos e-mails."
          );
          statusBanner.hidden = false;
        }
      } catch (err) {
        console.error("[MagicTranslator] Erreur lors de l'activation :", err);
      }
    });
  }

  // ── 3. Ouverture de la page complète des options ──────────────────────────
  if (btnOpenOptions) {
    btnOpenOptions.addEventListener("click", async () => {
      try {
        await browser.storage.local.set({ onboardingShown: true });
        await browser.runtime.openOptionsPage();
      } catch (err) {
        console.error("[MagicTranslator] Impossible d'ouvrir les options :", err);
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
