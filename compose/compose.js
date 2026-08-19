/**
 * Magic Translator — Logique Métier du Popup Mode Rédaction (Compose Mode)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Responsabilités :
 *   1. Récupérer l'e-mail en cours de rédaction (Objet, Corps et Sélection)
 *   2. Détecter si une sélection de texte est active dans l'éditeur
 *   3. Remplacer chirurgicalement la sélection via execCommand ou nœuds DOM directs
 *   4. Traduire l'Objet et le Corps in situ en direct en protégeant les citations
 *   5. Conserver l'état initial dans un coffre-fort persistant par onglet
 *   6. Permettre la restauration immédiate de l'original même après fermeture/réouverture de la popup
 */

"use strict";

// ── État Local de la Session de Rédaction ─────────────────────────────────────
let ongletActifId = null;
let etatOriginal = {
  sujet: null,
  extraitsCorps: null,
  selection: null,
  modeSelection: false,
  estTraduit: false
};
let texteSelectionne = "";
let aPermissionMoteur = true;
let origineRequise = "";

// ── Utilitaires d'Internationalisation ────────────────────────────────────────
function t(cle, repli = "") {
  try {
    const msg = browser.i18n.getMessage(cle);
    return msg || repli;
  } catch {
    return repli;
  }
}

function appliquerI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const cle = el.getAttribute("data-i18n");
    const traduction = t(cle);
    if (traduction) {
      el.textContent = traduction;
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const cle = el.getAttribute("data-i18n-title");
    const traduction = t(cle);
    if (traduction) {
      el.setAttribute("title", traduction);
    }
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const cle = el.getAttribute("data-i18n-aria-label");
    const traduction = t(cle);
    if (traduction) {
      el.setAttribute("aria-label", traduction);
    }
  });
}

// ── Gestion de l'Interface et du Statut ──────────────────────────────────────
function definirStatut(type, cleI18n, texteRepli) {
  const barre = document.getElementById("status-bar");
  const txt = document.getElementById("status-text");
  if (!barre || !txt) return;

  barre.className = `status-bar status-${type}`;
  txt.textContent = t(cleI18n, texteRepli);
}

// ── Fonction d'Autorisation 1-Clic sous Geste Utilisateur ───────────────────
async function demanderAutorisation1Clic() {
  if (!origineRequise) return true;
  try {
    if (browser.permissions && browser.permissions.request) {
      const accorde = await browser.permissions.request({ origins: [origineRequise] });
      if (accorde) {
        aPermissionMoteur = true;
        origineRequise = "";
        const dot = document.querySelector(".provider-dot");
        if (dot) dot.classList.remove("is-warning");
        const badge = document.getElementById("btn-provider-badge");
        const badgeTxt = document.getElementById("txt-provider-label");
        const nom = (badgeTxt && badgeTxt.textContent) || "Moteur";
        if (badge) {
          badge.title = `${nom} (Modifier dans les paramètres)`;
          badge.setAttribute("aria-label", `Paramètres du moteur : ${nom}`);
        }
        definirStatut("ready", "composeStatusReady", "Prêt");
        return true;
      }
    }
  } catch (err) {
    console.warn("[MagicTranslator:Compose] Demande permission 1-clic :", err);
  }
  return false;
}

// ── Chargement des Préférences et du Badge Moteur ─────────────────────────────
async function chargerBadgeMoteur() {
  try {
    const res = await browser.runtime.sendMessage({ action: "getConfig" });
    const badgeTxt = document.getElementById("txt-provider-label");
    const badge = document.getElementById("btn-provider-badge");
    const dot = document.querySelector(".provider-dot");

    if (res && res.success) {
      const nomLabel = res.providerLabel || "Google";
      const nomComplet = res.providerNom || nomLabel;
      if (badgeTxt) badgeTxt.textContent = nomLabel;

      if (res.hasPermission === false) {
        aPermissionMoteur = false;
        origineRequise = res.requiredOrigin;
        if (dot) dot.classList.add("is-warning");
        if (badge) {
          badge.title = `${nomComplet} (⚠️ Autorisation requise — Cliquez pour autoriser en 1 clic)`;
          badge.setAttribute("aria-label", `Autorisation requise pour ${nomComplet}`);
        }
      } else {
        aPermissionMoteur = true;
        origineRequise = "";
        if (dot) dot.classList.remove("is-warning");
        if (badge) {
          badge.title = `${nomComplet} (Modifier dans les paramètres)`;
          badge.setAttribute("aria-label", `Paramètres du moteur : ${nomComplet}`);
        }
      }
    }
  } catch (err) {
    console.warn("[MagicTranslator:Compose] Erreur badge moteur :", err);
  }
}

// ── Détection de la Sélection Active ──────────────────────────────────────────
async function detecterSelection(tabId) {
  try {
    const resultats = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const sel = window.getSelection();
        return sel ? sel.toString().trim() : "";
      }
    });

    if (resultats && resultats[0] && resultats[0].result) {
      return resultats[0].result;
    }
  } catch {
    // Si l'injection directe échoue, pas de sélection capturée
  }
  return "";
}

// ── Extraction et Injection Directe des Nœuds du Corps dans l'Éditeur ──────────
async function extraireNoeudsCorpsEditeur(tabId) {
  try {
    const resultats = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const BALISES_EXCLUES = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
        const estDansCitation = (noeud) => {
          let parent = noeud.parentElement;
          while (parent && parent !== document.body) {
            if (parent.tagName === "BLOCKQUOTE" && parent.getAttribute("type") === "cite") return true;
            if (parent.classList && (parent.classList.contains("moz-cite-prefix") || parent.classList.contains("moz-email-headers-table"))) return true;
            parent = parent.parentElement;
          }
          return false;
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(noeud) {
            if (!noeud.nodeValue || !noeud.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (noeud.parentElement && BALISES_EXCLUES.has(noeud.parentElement.tagName.toUpperCase())) return NodeFilter.FILTER_REJECT;
            if (estDansCitation(noeud)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        const extraits = [];
        let n;
        while ((n = walker.nextNode())) {
          extraits.push(n.nodeValue);
        }
        return extraits;
      }
    });

    if (resultats && resultats[0] && Array.isArray(resultats[0].result)) {
      return resultats[0].result;
    }
  } catch (err) {
    console.warn("[MagicTranslator:Compose] Erreur extraction nœuds corps :", err);
  }
  return [];
}

async function injecterTraductionsCorpsEditeur(tabId, traductions) {
  try {
    await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: (trads) => {
        const BALISES_EXCLUES = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
        const estDansCitation = (noeud) => {
          let parent = noeud.parentElement;
          while (parent && parent !== document.body) {
            if (parent.tagName === "BLOCKQUOTE" && parent.getAttribute("type") === "cite") return true;
            if (parent.classList && (parent.classList.contains("moz-cite-prefix") || parent.classList.contains("moz-email-headers-table"))) return true;
            parent = parent.parentElement;
          }
          return false;
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(noeud) {
            if (!noeud.nodeValue || !noeud.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (noeud.parentElement && BALISES_EXCLUES.has(noeud.parentElement.tagName.toUpperCase())) return NodeFilter.FILTER_REJECT;
            if (estDansCitation(noeud)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        let idx = 0;
        let n;
        while ((n = walker.nextNode()) && idx < trads.length) {
          n.nodeValue = trads[idx];
          idx++;
        }
      },
      args: [traductions]
    });
  } catch (err) {
    console.error("[MagicTranslator:Compose] Erreur injection traductions corps :", err);
    throw err;
  }
}

// ── Action : Traduire ────────────────────────────────────────────────────────
async function executerTraduction() {
  const btnTranslate = document.getElementById("btn-translate");
  const btnRestore = document.getElementById("btn-restore");
  const chkSubject = document.getElementById("chk-subject");
  const chkBody = document.getElementById("chk-body");
  const chkSelection = document.getElementById("chk-selection");
  const selectSource = document.getElementById("select-source");
  const selectTarget = document.getElementById("select-target");

  // Demande d'autorisation 1-clic préalable si la permission réseau manque
  if (!aPermissionMoteur && origineRequise) {
    const accorde = await demanderAutorisation1Clic();
    if (!accorde) {
      definirStatut("error", "composeStatusPermissionRequired", "Autorisation réseau requise pour traduire.");
      return;
    }
  }

  const sourceLang = selectSource.value;
  const targetLang = selectTarget.value;

  browser.storage.local.set({ composeLastTargetLang: targetLang }).catch(() => {});

  btnTranslate.disabled = true;
  definirStatut("busy", "composeStatusTranslating", "Traduction en cours…");

  try {
    const details = await browser.compose.getComposeDetails(ongletActifId);
    const cleCoffre = `compose_orig_${ongletActifId}`;

    // 1. Traduction de la Sélection uniquement
    if (texteSelectionne && chkSelection && chkSelection.checked) {
      if (!etatOriginal.estTraduit) {
        etatOriginal.selection = texteSelectionne;
        etatOriginal.modeSelection = true;
        etatOriginal.estTraduit = true;
        await browser.storage.local.set({ [cleCoffre]: etatOriginal });
      }

      const repSelection = await browser.runtime.sendMessage({
        action: "translate",
        text: texteSelectionne,
        source: sourceLang,
        target: targetLang
      });

      if (!repSelection || !repSelection.success) {
        throw new Error(repSelection ? repSelection.error : "SERVICE_UNAVAILABLE");
      }

      const texteTraduit = repSelection.text;

      // Remplacement natif et instantané dans l'éditeur de Thunderbird
      await browser.scripting.executeScript({
        target: { tabId: ongletActifId },
        func: (traduction) => {
          const editor = document.querySelector("body[contenteditable='true']") || document.body;
          if (editor && typeof editor.focus === "function") {
            editor.focus();
          }
          const succes = document.execCommand("insertText", false, traduction);
          if (!succes) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(document.createTextNode(traduction));
            }
          }
        },
        args: [texteTraduit]
      });

      btnRestore.disabled = false;
      definirStatut("ready", "composeStatusSuccess", "Message traduit avec succès ✓");
      return;
    }

    // 2. Traduction Globale (Objet et/ou Corps)
    // 2.a Traduction de l'Objet (Sujet) via setComposeDetails
    if (chkSubject && chkSubject.checked && details.subject && details.subject.trim()) {
      if (etatOriginal.sujet === null) {
        etatOriginal.sujet = details.subject;
      }

      const repSubject = await browser.runtime.sendMessage({
        action: "translate",
        text: details.subject,
        source: sourceLang,
        target: targetLang
      });

      if (repSubject && repSubject.success) {
        await browser.compose.setComposeDetails(ongletActifId, { subject: repSubject.text });
      }
    }

    // 2.b Traduction du Corps in situ via injection directe dans le DOM de l'éditeur
    if (chkBody && chkBody.checked) {
      const extraits = await extraireNoeudsCorpsEditeur(ongletActifId);

      if (extraits && extraits.length > 0) {
        if (etatOriginal.extraitsCorps === null) {
          etatOriginal.extraitsCorps = [...extraits];
        }

        const traductions = [];
        for (const ext of extraits) {
          const rep = await browser.runtime.sendMessage({
            action: "translate",
            text: ext.trim(),
            source: sourceLang,
            target: targetLang
          });

          if (rep && rep.success && rep.text) {
            const lead = ext.match(/^\s*/)[0];
            const trail = ext.match(/\s*$/)[0];
            traductions.push(lead + rep.text + trail);
          } else {
            traductions.push(ext);
          }
        }

        await injecterTraductionsCorpsEditeur(ongletActifId, traductions);
      }
    }

    etatOriginal.modeSelection = false;
    etatOriginal.estTraduit = true;

    // Persister dans le coffre-fort par onglet pour survie à la fermeture de la popup
    await browser.storage.local.set({ [cleCoffre]: etatOriginal });

    btnRestore.disabled = false;
    definirStatut("ready", "composeStatusSuccess", "Message traduit avec succès ✓");
  } catch (err) {
    console.error("[MagicTranslator:Compose] Erreur lors de la traduction :", err);
    if (err.message === "PERMISSION_REQUIRED") {
      definirStatut("error", "composeStatusPermissionRequired", "Autorisation réseau requise pour traduire.");
    } else {
      definirStatut("error", "composeStatusError", "Erreur de traduction (" + (err.message || "réseau") + ")");
    }
  } finally {
    btnTranslate.disabled = false;
  }
}

// ── Action : Restaurer l'Original ─────────────────────────────────────────────
async function executerRestauration() {
  const btnRestore = document.getElementById("btn-restore");

  if (!etatOriginal.estTraduit) {
    return;
  }

  btnRestore.disabled = true;
  definirStatut("busy", "composeStatusRestoring", "Restauration en cours…");

  try {
    const cleCoffre = `compose_orig_${ongletActifId}`;

    // 1. Restauration de la Sélection
    if (etatOriginal.modeSelection && etatOriginal.selection) {
      const texteOriginal = etatOriginal.selection;
      await browser.scripting.executeScript({
        target: { tabId: ongletActifId },
        func: (original) => {
          const editor = document.querySelector("body[contenteditable='true']") || document.body;
          if (editor && typeof editor.focus === "function") {
            editor.focus();
          }
          const succes = document.execCommand("insertText", false, original);
          if (!succes) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(document.createTextNode(original));
            }
          }
        },
        args: [texteOriginal]
      });

      etatOriginal.estTraduit = false;
      await browser.storage.local.remove(cleCoffre);
      btnRestore.disabled = true;
      definirStatut("ready", "composeStatusRestored", "Texte d'origine restauré ✓");
      return;
    }

    // 2. Restauration Globale (Objet + Corps)
    const detailsRestauration = {};

    if (etatOriginal.sujet !== null) {
      detailsRestauration.subject = etatOriginal.sujet;
    }

    if (Object.keys(detailsRestauration).length > 0) {
      await browser.compose.setComposeDetails(ongletActifId, detailsRestauration);
    }

    if (etatOriginal.extraitsCorps && Array.isArray(etatOriginal.extraitsCorps)) {
      await injecterTraductionsCorpsEditeur(ongletActifId, etatOriginal.extraitsCorps);
    }

    etatOriginal.estTraduit = false;
    await browser.storage.local.remove(cleCoffre);

    btnRestore.disabled = true;
    definirStatut("ready", "composeStatusRestored", "Texte d'origine restauré ✓");
  } catch (err) {
    console.error("[MagicTranslator:Compose] Erreur lors de la restauration :", err);
    definirStatut("error", "composeStatusRestoreError", "Échec de la restauration (" + (err.message || "inconnu") + ")");
    btnRestore.disabled = false;
  }
}

// ── Initialisation au Chargement du Document ─────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  appliquerI18n();

  // Identifier l'onglet de composition actif
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      ongletActifId = tabs[0].id;
    }
  } catch (err) {
    console.warn("[MagicTranslator:Compose] Impossible d'identifier l'onglet actif :", err);
  }

  if (!ongletActifId) {
    definirStatut("error", "composeStatusErrorNoTab", "Impossible d'accéder au message.");
    return;
  }

  // Charger le badge moteur en direct
  await chargerBadgeMoteur();

  // Restaurer l'état de traduction si déjà effectué
  try {
    const cleCoffre = `compose_orig_${ongletActifId}`;
    const stockCoffre = await browser.storage.local.get(cleCoffre);
    const btnRestore = document.getElementById("btn-restore");

    if (stockCoffre && stockCoffre[cleCoffre] && stockCoffre[cleCoffre].estTraduit) {
      etatOriginal = stockCoffre[cleCoffre];
      if (btnRestore) {
        btnRestore.disabled = false;
      }
      definirStatut("ready", "composeStatusRestorable", "Traduction active (Restauration disponible)");
    }
  } catch (err) {
    console.warn("[MagicTranslator:Compose] Erreur lecture coffre-fort :", err);
  }

  // Restaurer la dernière langue cible choisie
  try {
    const stockLang = await browser.storage.local.get({ composeLastTargetLang: "en" });
    const selectTarget = document.getElementById("select-target");
    if (selectTarget && stockLang.composeLastTargetLang) {
      selectTarget.value = stockLang.composeLastTargetLang;
    }
  } catch {
    // Ignorer
  }

  // Détecter si une sélection est active
  texteSelectionne = await detecterSelection(ongletActifId);
  const selectionBanner = document.getElementById("selection-banner");
  const txtSelectionCount = document.getElementById("txt-selection-count");
  const chkSelection = document.getElementById("chk-selection");
  const globalOptions = document.getElementById("global-options");

  if (texteSelectionne && texteSelectionne.length > 0) {
    selectionBanner.classList.remove("is-hidden");
    const nbMots = texteSelectionne.split(/\s+/).filter(Boolean).length;
    txtSelectionCount.textContent = `${t("composeSelectionActive", "Sélection active")} (${nbMots} ${nbMots > 1 ? "mots" : "mot"})`;

    chkSelection.addEventListener("change", () => {
      if (chkSelection.checked) {
        globalOptions.style.opacity = "0.5";
      } else {
        globalOptions.style.opacity = "1";
      }
    });
    globalOptions.style.opacity = "0.5";
  }

  // Écouteurs d'événements
  document.getElementById("btn-translate").addEventListener("click", executerTraduction);
  document.getElementById("btn-restore").addEventListener("click", executerRestauration);

  // Inverser les langues
  document.getElementById("btn-swap-lang").addEventListener("click", () => {
    const selectSource = document.getElementById("select-source");
    const selectTarget = document.getElementById("select-target");
    const srcVal = selectSource.value;
    const tgtVal = selectTarget.value;
    if (srcVal !== "auto") {
      selectSource.value = tgtVal;
      selectTarget.value = srcVal;
    }
  });

  // Clic sur le badge moteur pour demander l'autorisation 1-clic ou ouvrir les options
  document.getElementById("btn-provider-badge").addEventListener("click", async () => {
    if (!aPermissionMoteur && origineRequise) {
      const accorde = await demanderAutorisation1Clic();
      if (accorde) return;
    }
    browser.runtime.openOptionsPage();
  });
});
