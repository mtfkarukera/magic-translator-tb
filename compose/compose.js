/**
 * Magic Translator — Logique Métier du Popup Mode Rédaction (Compose Mode)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Responsabilités :
 *   1. Récupérer l'e-mail en cours de rédaction (Objet, Corps et Sélection)
 *   2. Détecter si une sélection de texte est active dans l'éditeur
 *   3. Remplacer chirurgicalement la sélection et conserver un snapshot DOM fiable pour la restauration
 *   4. Traduire l'Objet et le Corps par lots (MTSEP) en protégeant les citations et les balises techniques
 *   5. Conserver l'état initial dans le stockage de session éphémère par onglet (browser.storage.session)
 *   6. Permettre la restauration immédiate et vérifiée de l'original même après fermeture/réouverture de la popup
 */

"use strict";

// ── État Local de la Session de Rédaction ─────────────────────────────────────
let ongletActifId = null;
let etatOriginal = {
  sujet: null,
  corpsHtml: null,
  corpsTexte: null,
  isPlainText: null,
  extraitsCorps: null,
  estTraduit: false
};
let texteSelectionne = "";
let aPermissionMoteur = true;
let estMoteurConfigure = true;
let consentementRequis = false;
let origineRequise = "";
let langueAlternance = "none";

const { decouperLong, extraireEspaces } = globalThis.MTText;
const LOCALES_SUPPORTEES = new Set(["fr", "en", "de", "es", "vi", "ja", "pt"]);
const memoireSessionFallback = new Map();

function obtenirStockageSession() {
  if (browser.storage && browser.storage.session) {
    return browser.storage.session;
  }
  // Repli purement en RAM (aucune écriture de brouillon sur disque)
  return {
    get: async (cle) => ({ [cle]: memoireSessionFallback.get(cle) }),
    set: async (obj) => {
      Object.entries(obj).forEach(([k, v]) => memoireSessionFallback.set(k, v));
    },
    remove: async (cle) => {
      memoireSessionFallback.delete(cle);
    }
  };
}

function definirValeurSelectSiPresente(selectEl, valeur) {
  if (!selectEl || !valeur) return false;
  const existe = Array.from(selectEl.options).some((opt) => opt.value === valeur);
  if (!existe) return false;
  selectEl.value = valeur;
  return true;
}

async function envoyerMessageTraduction(texte, source, target) {
  const keepAliveId = setInterval(() => {
    browser.runtime.sendMessage({ action: "ping" }).catch(() => {});
  }, 18000);
  try {
    const rep = await browser.runtime.sendMessage({
      action: "translate",
      text: texte,
      source,
      target
    });
    if (!rep || !rep.success) {
      throw new Error((rep && rep.error) || "SERVICE_UNAVAILABLE");
    }
    return rep;
  } finally {
    clearInterval(keepAliveId);
  }
}

function languesSontEquivalentes(l1, l2) {
  if (!l1 || !l2) return false;
  const n1 = l1.toLowerCase();
  const n2 = l2.toLowerCase();
  if (n1 === n2) return true;
  return n1.split("-")[0] === n2.split("-")[0];
}

// ── Utilitaires d'Internationalisation ────────────────────────────────────────
function t(cle, repli = "", remplacements = null) {
  let msg = repli;
  try {
    const trad = browser.i18n.getMessage(cle);
    if (trad) msg = trad;
  } catch {
    msg = repli;
  }
  if (remplacements && msg) {
    Object.keys(remplacements).forEach((k) => {
      msg = msg.replace("{" + k + "}", String(remplacements[k]));
    });
  }
  return msg;
}

function appliquerI18n() {
  const uiLang = browser.i18n ? browser.i18n.getUILanguage() : "en";
  const codePrimaire = uiLang ? uiLang.split("-")[0].toLowerCase() : "en";
  document.documentElement.lang = LOCALES_SUPPORTEES.has(codePrimaire) ? codePrimaire : "en";

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
function definirStatut(type, cleI18n, texteRepli, detail = "") {
  const barre = document.getElementById("status-bar");
  const txt = document.getElementById("status-text");
  if (!barre || !txt) return;

  barre.className = `status-bar status-${type}`;
  const base = t(cleI18n, texteRepli);
  txt.textContent = detail ? `${base} (${detail})` : base;
}

function synchroniserBoutonTraduire(enCours = false) {
  const btnTranslate = document.getElementById("btn-translate");
  if (!btnTranslate) return;
  if (enCours) {
    btnTranslate.disabled = true;
    btnTranslate.setAttribute("aria-busy", "true");
    return;
  }
  btnTranslate.removeAttribute("aria-busy");
  btnTranslate.disabled = Boolean(consentementRequis);
}

function synchroniserLibelleBoutonTraduire() {
  const txtBtn = document.getElementById("txt-btn-translate");
  if (!txtBtn) return;
  txtBtn.textContent = etatOriginal.estTraduit
    ? t("composeBtnRetranslate", "Retraduire")
    : t("composeBtnTranslate", "Traduire");
}

function mettreAJourCompteurSelection() {
  const selectionBanner = document.getElementById("selection-banner");
  const txtSelectionCount = document.getElementById("txt-selection-count");
  if (!selectionBanner || !txtSelectionCount) return;
  if (texteSelectionne && texteSelectionne.length > 0) {
    selectionBanner.classList.remove("is-hidden");
    const nbCars = texteSelectionne.length;
    const cle = nbCars > 1 ? "composeSelectionCountPlural" : "composeSelectionCountSingular";
    txtSelectionCount.textContent = t(cle, "({count} car.)", { count: nbCars });
  }
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
        await chargerBadgeMoteur();
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
    const consentBanner = document.getElementById("consent-banner");
    const chkConsentMyMemory = document.getElementById("chk-consent-mymemory");

    if (res && res.success) {
      if (chkConsentMyMemory) {
        chkConsentMyMemory.checked = Boolean(res.enableMyMemoryFallback);
      }
      if (res.alternateTarget) {
        langueAlternance = res.alternateTarget;
      }

      if (res.consentRequired || res.provider === "none") {
        consentementRequis = true;
        estMoteurConfigure = false;
        if (consentBanner) consentBanner.classList.remove("is-hidden");
        if (badgeTxt) badgeTxt.textContent = t("composeBadgeUnconfigured", "À activer");
        if (dot) dot.classList.add("is-warning");
        if (badge) {
          const msgConsent = t("composeStatusConsentRequired", "Veuillez activer un moteur de traduction.");
          badge.title = msgConsent;
          badge.setAttribute("aria-label", msgConsent);
        }
        synchroniserBoutonTraduire(false);
        return;
      }

      consentementRequis = false;
      estMoteurConfigure = res.isConfigured !== false;
      if (consentBanner) consentBanner.classList.add("is-hidden");
      const nomLabel = res.providerLabel || "Google";
      const nomComplet = res.providerNom || nomLabel;
      if (badgeTxt) badgeTxt.textContent = nomLabel;

      if (res.hasPermission === false) {
        aPermissionMoteur = false;
        origineRequise = res.requiredOrigin || "";
        if (dot) dot.classList.add("is-warning");
        if (badge) {
          const titrePerm = t("composeBadgePermWarningTitle", "{provider} (Autorisation requise — Cliquez pour autoriser)", { provider: nomComplet });
          badge.title = titrePerm;
          badge.setAttribute("aria-label", titrePerm);
        }
      } else if (!estMoteurConfigure) {
        aPermissionMoteur = true;
        origineRequise = "";
        if (dot) dot.classList.add("is-warning");
        if (badge) {
          const titreCle = t("composeBadgeKeyWarningTitle", "{provider} (Clé d'API requise — Cliquez pour configurer)", { provider: nomComplet });
          badge.title = titreCle;
          badge.setAttribute("aria-label", titreCle);
        }
      } else {
        aPermissionMoteur = true;
        origineRequise = "";
        if (dot) dot.classList.remove("is-warning");
        if (badge) {
          const titreActif = t("composeBadgeActiveTitle", "{provider} (Modifier dans les paramètres)", { provider: nomComplet });
          badge.title = titreActif;
          badge.setAttribute("aria-label", titreActif);
        }
      }
      synchroniserBoutonTraduire(false);
    }
  } catch (err) {
    console.warn("[MagicTranslator:Compose] Erreur badge moteur :", err);
  }
}

function mettreAJourBadgeDepuisReponse(rep) {
  if (!rep || !rep.providerLabel) return;
  const badgeTxt = document.getElementById("txt-provider-label");
  const badge = document.getElementById("btn-provider-badge");
  const brut = rep.usedFallback ? t("composeBadgeFallbackSuffix", "secours").trim() : "";
  const suffixe = brut ? (brut.startsWith("(") ? ` ${brut}` : ` (${brut})`) : "";
  if (badgeTxt) {
    badgeTxt.textContent = rep.providerLabel + suffixe;
  }
  if (badge) {
    const nomComplet = (rep.providerNom || rep.providerLabel) + suffixe;
    const titreActif = t("composeBadgeActiveTitle", "{provider} (Modifier dans les paramètres)", { provider: nomComplet });
    badge.title = titreActif;
    badge.setAttribute("aria-label", titreActif);
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

// ── Extraction et Injection Directe des Nœuds / Sélection dans l'Éditeur ──
async function extraireNoeudsCorpsEditeur(tabId) {
  try {
    const resultats = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const BALISES_EXCLUES = new Set([
          "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT",
          "EMBED", "SVG", "MATH", "CODE", "TEXTAREA", "TEMPLATE"
        ]);
        const estExcluOuDansCitation = (noeud) => {
          let parent = noeud.parentElement;
          while (parent && parent !== document.body) {
            const nom = (parent.tagName || "").toUpperCase();
            if (BALISES_EXCLUES.has(nom)) return true;
            if (parent.hidden || parent.getAttribute("aria-hidden") === "true") return true;
            if (parent.style && typeof parent.style.display === "string" && parent.style.display.toLowerCase() === "none") return true;
            try {
              const st = getComputedStyle(parent);
              if (
                st.display === "none" ||
                st.visibility === "hidden" ||
                st.visibility === "collapse" ||
                st.opacity === "0" ||
                parseFloat(st.fontSize) === 0
              ) {
                return true;
              }
            } catch { /* ignorer */ }
            if (nom === "BLOCKQUOTE" && parent.getAttribute("type") === "cite") return true;
            if (
              parent.classList &&
              (parent.classList.contains("moz-cite-prefix") ||
                parent.classList.contains("moz-email-headers-table") ||
                parent.classList.contains("gmail_quote"))
            ) {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(noeud) {
            if (!noeud.nodeValue || !noeud.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (!noeud.parentElement || estExcluOuDansCitation(noeud)) return NodeFilter.FILTER_REJECT;
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
    const resultats = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: (trads) => {
        const BALISES_EXCLUES = new Set([
          "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT",
          "EMBED", "SVG", "MATH", "CODE", "TEXTAREA", "TEMPLATE"
        ]);
        const estExcluOuDansCitation = (noeud) => {
          let parent = noeud.parentElement;
          while (parent && parent !== document.body) {
            const nom = (parent.tagName || "").toUpperCase();
            if (BALISES_EXCLUES.has(nom)) return true;
            if (parent.hidden || parent.getAttribute("aria-hidden") === "true") return true;
            if (parent.style && typeof parent.style.display === "string" && parent.style.display.toLowerCase() === "none") return true;
            try {
              const st = getComputedStyle(parent);
              if (
                st.display === "none" ||
                st.visibility === "hidden" ||
                st.visibility === "collapse" ||
                st.opacity === "0" ||
                parseFloat(st.fontSize) === 0
              ) {
                return true;
              }
            } catch { /* ignorer */ }
            if (nom === "BLOCKQUOTE" && parent.getAttribute("type") === "cite") return true;
            if (
              parent.classList &&
              (parent.classList.contains("moz-cite-prefix") ||
                parent.classList.contains("moz-email-headers-table") ||
                parent.classList.contains("gmail_quote"))
            ) {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(noeud) {
            if (!noeud.nodeValue || !noeud.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (!noeud.parentElement || estExcluOuDansCitation(noeud)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        let idx = 0;
        let n;
        while ((n = walker.nextNode()) && idx < trads.length) {
          n.nodeValue = trads[idx];
          idx++;
        }
        if (idx > 0 && document.body) {
          document.body.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }
        return idx;
      },
      args: [traductions]
    });
    return (resultats && resultats[0] && typeof resultats[0].result === "number") ? resultats[0].result : 0;
  } catch (err) {
    console.error("[MagicTranslator:Compose] Erreur injection traductions corps :", err);
    throw err;
  }
}

async function extraireTranchesSelectionEditeur(tabId) {
  try {
    const resultats = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
          return [];
        }
        const range = sel.getRangeAt(0);
        const BALISES_EXCLUES = new Set([
          "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT",
          "EMBED", "SVG", "MATH", "CODE", "TEXTAREA", "TEMPLATE"
        ]);
        const estExcluOuDansCitation = (noeud) => {
          let parent = noeud.parentElement;
          while (parent && parent !== document.body) {
            const nom = (parent.tagName || "").toUpperCase();
            if (BALISES_EXCLUES.has(nom)) return true;
            if (parent.hidden || parent.getAttribute("aria-hidden") === "true") return true;
            if (parent.style && typeof parent.style.display === "string" && parent.style.display.toLowerCase() === "none") return true;
            try {
              const st = getComputedStyle(parent);
              if (
                st.display === "none" ||
                st.visibility === "hidden" ||
                st.visibility === "collapse" ||
                st.opacity === "0" ||
                parseFloat(st.fontSize) === 0
              ) {
                return true;
              }
            } catch { /* ignorer */ }
            if (nom === "BLOCKQUOTE" && parent.getAttribute("type") === "cite") return true;
            if (
              parent.classList &&
              (parent.classList.contains("moz-cite-prefix") ||
                parent.classList.contains("moz-email-headers-table") ||
                parent.classList.contains("gmail_quote"))
            ) {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(noeud) {
            if (!noeud.nodeValue || !noeud.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (!noeud.parentElement || estExcluOuDansCitation(noeud)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        const tranches = [];
        let nodeIndex = 0;
        let n;
        while ((n = walker.nextNode())) {
          if (range.intersectsNode(n)) {
            const val = n.nodeValue || "";
            const start = (n === range.startContainer) ? Math.max(0, Math.min(val.length, range.startOffset)) : 0;
            const end = (n === range.endContainer) ? Math.max(0, Math.min(val.length, range.endOffset)) : val.length;
            if (end > start) {
              const tranche = val.slice(start, end);
              if (tranche.trim()) {
                tranches.push({ nodeIndex, start, end, text: tranche });
              }
            }
          }
          nodeIndex++;
        }
        return tranches;
      }
    });
    return (resultats && resultats[0] && Array.isArray(resultats[0].result)) ? resultats[0].result : [];
  } catch (err) {
    console.warn("[MagicTranslator:Compose] Erreur extraction sélection :", err);
    return [];
  }
}

async function injecterTranchesSelectionEditeur(tabId, patchs) {
  try {
    const resultats = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: (listePatchs) => {
        const BALISES_EXCLUES = new Set([
          "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT",
          "EMBED", "SVG", "MATH", "CODE", "TEXTAREA", "TEMPLATE"
        ]);
        const estExcluOuDansCitation = (noeud) => {
          let parent = noeud.parentElement;
          while (parent && parent !== document.body) {
            const nom = (parent.tagName || "").toUpperCase();
            if (BALISES_EXCLUES.has(nom)) return true;
            if (parent.hidden || parent.getAttribute("aria-hidden") === "true") return true;
            if (parent.style && typeof parent.style.display === "string" && parent.style.display.toLowerCase() === "none") return true;
            try {
              const st = getComputedStyle(parent);
              if (
                st.display === "none" ||
                st.visibility === "hidden" ||
                st.visibility === "collapse" ||
                st.opacity === "0" ||
                parseFloat(st.fontSize) === 0
              ) {
                return true;
              }
            } catch { /* ignorer */ }
            if (nom === "BLOCKQUOTE" && parent.getAttribute("type") === "cite") return true;
            if (
              parent.classList &&
              (parent.classList.contains("moz-cite-prefix") ||
                parent.classList.contains("moz-email-headers-table") ||
                parent.classList.contains("gmail_quote"))
            ) {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(noeud) {
            if (!noeud.nodeValue || !noeud.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (!noeud.parentElement || estExcluOuDansCitation(noeud)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        const noeuds = [];
        let n;
        while ((n = walker.nextNode())) {
          noeuds.push(n);
        }

        let nbInjectes = 0;
        let premierNoeud = null;
        let premierStart = 0;
        let dernierNoeud = null;
        let dernierEnd = 0;

        for (const p of listePatchs) {
          const cible = noeuds[p.nodeIndex];
          if (!cible) continue;
          const val = cible.nodeValue || "";
          cible.nodeValue = val.slice(0, p.start) + p.translated + val.slice(p.end);
          if (!premierNoeud) {
            premierNoeud = cible;
            premierStart = p.start;
          }
          dernierNoeud = cible;
          dernierEnd = p.start + p.translated.length;
          nbInjectes++;
        }

        if (nbInjectes > 0) {
          if (premierNoeud && dernierNoeud) {
            const sel = window.getSelection();
            if (sel) {
              const nouveauRange = document.createRange();
              nouveauRange.setStart(premierNoeud, premierStart);
              nouveauRange.setEnd(dernierNoeud, dernierEnd);
              sel.removeAllRanges();
              sel.addRange(nouveauRange);
            }
          }
          if (document.body) {
            document.body.dispatchEvent(new InputEvent("input", { bubbles: true }));
          }
        }
        return nbInjectes;
      },
      args: [patchs]
    });
    return (resultats && resultats[0] && typeof resultats[0].result === "number") ? resultats[0].result : 0;
  } catch (err) {
    console.error("[MagicTranslator:Compose] Erreur injection sélection :", err);
    throw err;
  }
}

// ── Traduction par lots des extraits du corps (protocole MTSEP) ──────────────
async function traduireExtraitsParLots(extraits, sourceInit, targetInit) {
  let source = sourceInit;
  let target = targetInit;
  const texteJoint = extraits.join("\n");

  const hex4 = () => {
    const buf = new Uint16Array(1);
    crypto.getRandomValues(buf);
    return buf[0].toString(16).padStart(4, "0");
  };
  let SENTINEL;
  do {
    SENTINEL = "MTSEP" + hex4() + hex4() + hex4() + hex4() + hex4() + hex4();
  } while (texteJoint.toUpperCase().includes(SENTINEL.toUpperCase()));

  const SEPARATEUR = "\n" + SENTINEL + "\n";
  const SEPARATEUR_RE = new RegExp("\\s{0,20}" + SENTINEL + "\\s{0,20}", "gi");
  const TAILLE_MAX_LOT = 4000;

  const lots = [];
  let lotCourant = { items: [], texte: "" };

  extraits.forEach((ext, index) => {
    const { lead, coeur, trail } = extraireEspaces(ext);
    if (!coeur) return;
    const tailSep = lotCourant.texte ? SEPARATEUR.length : 0;
    if (lotCourant.texte.length + tailSep + coeur.length > TAILLE_MAX_LOT && lotCourant.items.length > 0) {
      lots.push(lotCourant);
      lotCourant = { items: [], texte: "" };
    }
    lotCourant.items.push({ index, lead, coeur, trail });
    lotCourant.texte += (lotCourant.texte ? SEPARATEUR : "") + coeur;
  });
  if (lotCourant.items.length > 0) {
    lots.push(lotCourant);
  }

  const resultatFinal = [...extraits];
  let derniereReponse = null;

  const appelerTraduction = async (txt, AutoriserAlternanceAuto = false) => {
    let rep = await envoyerMessageTraduction(txt, source, target);
    if (
      AutoriserAlternanceAuto &&
      source === "auto" &&
      rep.detectedLang &&
      languesSontEquivalentes(rep.detectedLang, target) &&
      langueAlternance &&
      langueAlternance !== "none" &&
      !languesSontEquivalentes(langueAlternance, rep.detectedLang)
    ) {
      target = langueAlternance;
      source = rep.detectedLang;
      definirValeurSelectSiPresente(document.getElementById("select-target"), target);
      rep = await envoyerMessageTraduction(txt, source, target);
    }
    derniereReponse = rep;
    return rep;
  };

  for (let lIdx = 0; lIdx < lots.length; lIdx++) {
    const lot = lots[lIdx];
    const autoriserAlt = lIdx === 0;

    if (lot.items.length === 1 && lot.texte.length > TAILLE_MAX_LOT) {
      const item = lot.items[0];
      const segments = decouperLong(lot.texte, TAILLE_MAX_LOT);
      const morceaux = [];
      for (let sIdx = 0; sIdx < segments.length; sIdx++) {
        const { lead: sLead, coeur: sCoeur, trail: sTrail } = extraireEspaces(segments[sIdx]);
        if (!sCoeur) {
          morceaux.push(segments[sIdx]);
          continue;
        }
        const repSeg = await appelerTraduction(sCoeur, autoriserAlt && sIdx === 0);
        morceaux.push(sLead + repSeg.text + sTrail);
      }
      resultatFinal[item.index] = item.lead + morceaux.join("") + item.trail;
      continue;
    }

    const repLot = await appelerTraduction(lot.texte, autoriserAlt);
    if (lot.items.length === 1) {
      const item = lot.items[0];
      resultatFinal[item.index] = item.lead + repLot.text.replace(SEPARATEUR_RE, "").trim() + item.trail;
    } else {
      const parties = repLot.text.split(SEPARATEUR_RE);
      if (parties.length === lot.items.length) {
        lot.items.forEach((item, idx) => {
          resultatFinal[item.index] = item.lead + parties[idx].trim() + item.trail;
        });
      } else {
        for (const item of lot.items) {
          const repUnitaire = await appelerTraduction(item.coeur, false);
          resultatFinal[item.index] = item.lead + repUnitaire.text.trim() + item.trail;
        }
      }
    }
  }

  return { traductions: resultatFinal, targetEffective: target, derniereReponse };
}

async function lireCoffreOnglet(cleCoffre) {
  const sessionStore = obtenirStockageSession();
  const resSession = await sessionStore.get(cleCoffre);
  if (resSession && resSession[cleCoffre]) {
    return resSession[cleCoffre];
  }
  return null;
}

async function ecrireCoffreOnglet(cleCoffre, valeur) {
  await obtenirStockageSession().set({ [cleCoffre]: valeur });
}

async function supprimerCoffreOnglet(cleCoffre) {
  await obtenirStockageSession().remove(cleCoffre);
  if (browser.storage && browser.storage.local) {
    await browser.storage.local.remove(cleCoffre).catch(() => {});
  }
}

async function assurerSnapshotOriginal(details, { capturerSujet = false, capturerCorps = false, extraitsInitial = null } = {}) {
  const cleCoffre = `compose_orig_${ongletActifId}`;
  let modifie = false;

  if (capturerSujet && etatOriginal.sujet === null) {
    etatOriginal.sujet = details.subject || "";
    modifie = true;
  }

  if (capturerCorps && etatOriginal.corpsHtml === null && etatOriginal.corpsTexte === null) {
    const estTexteBrut = Boolean(details.isPlainText);
    etatOriginal.isPlainText = estTexteBrut;
    if (estTexteBrut) {
      etatOriginal.corpsTexte = details.plainTextBody || "";
      etatOriginal.corpsHtml = null;
    } else {
      etatOriginal.corpsHtml = details.body || "";
      etatOriginal.corpsTexte = null;
    }
    etatOriginal.extraitsCorps = Array.isArray(extraitsInitial)
      ? [...extraitsInitial]
      : await extraireNoeudsCorpsEditeur(ongletActifId);
    modifie = true;
  }

  if (!etatOriginal.estTraduit) {
    etatOriginal.estTraduit = true;
    modifie = true;
  }

  if (modifie) {
    await ecrireCoffreOnglet(cleCoffre, etatOriginal);
  }
}

function rafraichirEtatSelectionUI() {
  const selectionBanner = document.getElementById("selection-banner");
  const chkSelection = document.getElementById("chk-selection");
  const globalOptions = document.getElementById("global-options");
  const chkSubject = document.getElementById("chk-subject");
  const chkBody = document.getElementById("chk-body");

  const aSelection = Boolean(texteSelectionne && texteSelectionne.length > 0);
  if (selectionBanner) {
    selectionBanner.classList.toggle("is-hidden", !aSelection);
  }
  if (aSelection) {
    mettreAJourCompteurSelection();
  }
  const modeSelectionActif = Boolean(aSelection && chkSelection && chkSelection.checked);
  if (globalOptions) {
    globalOptions.classList.toggle("is-disabled", modeSelectionActif);
  }
  if (chkSubject) chkSubject.disabled = modeSelectionActif;
  if (chkBody) chkBody.disabled = modeSelectionActif;
}

// ── Action : Traduire ────────────────────────────────────────────────────────
async function executerTraduction() {
  const btnRestore = document.getElementById("btn-restore");
  const chkSubject = document.getElementById("chk-subject");
  const chkBody = document.getElementById("chk-body");
  const chkSelection = document.getElementById("chk-selection");
  const selectSource = document.getElementById("select-source");
  const selectTarget = document.getElementById("select-target");

  if (consentementRequis) {
    const consentBanner = document.getElementById("consent-banner");
    if (consentBanner) consentBanner.classList.remove("is-hidden");
    const btnConsentAccept = document.getElementById("btn-consent-accept");
    if (btnConsentAccept) btnConsentAccept.focus();
    definirStatut("error", "composeStatusConsentRequired", "Veuillez activer un moteur ci-dessus.");
    return;
  }

  if (!aPermissionMoteur && origineRequise) {
    const accorde = await demanderAutorisation1Clic();
    if (!accorde) {
      definirStatut("error", "composeStatusPermissionRequired", "Autorisation réseau requise pour traduire.");
      return;
    }
  }

  if (!estMoteurConfigure) {
    definirStatut("error", "errorUnauthorized", "Clé d'API manquante ou invalide. Ouvrez les réglages.");
    return;
  }

  const sourceLang = selectSource.value;
  let targetLang = selectTarget.value;

  if (languesSontEquivalentes(sourceLang, targetLang)) {
    if (langueAlternance && langueAlternance !== "none" && !languesSontEquivalentes(langueAlternance, sourceLang)) {
      targetLang = langueAlternance;
      selectTarget.value = targetLang;
    } else {
      definirStatut("error", "errorSameLanguage", "Les langues source et cible sont identiques.");
      return;
    }
  }

  browser.storage.local.set({ composeLastTargetLang: targetLang }).catch(() => {});

  synchroniserBoutonTraduire(true);
  definirStatut("busy", "composeStatusTranslating", "Traduction en cours…");

  try {
    const details = await browser.compose.getComposeDetails(ongletActifId);

    // 1. Traduction de la Sélection par tranches de TextNode (préserve <b>, <p>, <br>)
    if (texteSelectionne && chkSelection && chkSelection.checked) {
      const tranches = await extraireTranchesSelectionEditeur(ongletActifId);
      if (tranches.length === 0) {
        throw new Error("SELECTION_EMPTY");
      }

      const resSel = await traduireExtraitsParLots(
        tranches.map((tr) => tr.text),
        sourceLang,
        targetLang
      );
      targetLang = resSel.targetEffective;
      mettreAJourBadgeDepuisReponse(resSel.derniereReponse);

      await assurerSnapshotOriginal(details, { capturerCorps: true });

      const patchs = tranches.map((tr, idx) => ({
        nodeIndex: tr.nodeIndex,
        start: tr.start,
        end: tr.end,
        translated: resSel.traductions[idx]
      }));
      const nbInjectes = await injecterTranchesSelectionEditeur(ongletActifId, patchs);
      if (nbInjectes === 0) {
        throw new Error("SELECTION_EMPTY");
      }

      texteSelectionne = await detecterSelection(ongletActifId);
      rafraichirEtatSelectionUI();
      btnRestore.disabled = false;
      synchroniserLibelleBoutonTraduire();
      definirStatut("ready", "composeStatusSuccess", "Message traduit avec succès ✓");
      return;
    }

    // 2. Traduction Globale atomique (Objet et/ou Corps)
    const veutObjet = Boolean(chkSubject && chkSubject.checked);
    const veutCorps = Boolean(chkBody && chkBody.checked);

    if (!veutObjet && !veutCorps) {
      definirStatut("error", "composeStatusNoScopeSelected", "Veuillez cocher au moins l'Objet ou le Corps.");
      return;
    }

    const sujetInitial = (etatOriginal.sujet !== null)
      ? etatOriginal.sujet
      : (details.subject || "");
    const aObjetNonVide = Boolean(veutObjet && sujetInitial.trim());

    let extraitsSource = [];
    if (veutCorps) {
      extraitsSource = (Array.isArray(etatOriginal.extraitsCorps))
        ? etatOriginal.extraitsCorps
        : await extraireNoeudsCorpsEditeur(ongletActifId);
    }
    const aCorpsNonVide = Boolean(veutCorps && extraitsSource.some((s) => s && s.trim()));

    if (!aObjetNonVide && !aCorpsNonVide) {
      definirStatut("error", "errorNoText", "Aucun texte à traduire.");
      return;
    }

    // 2.a Traduction en mémoire d'abord (lot unique Objet + Corps si les deux sont présents)
    let sujetTraduit = null;
    let traductionsCorps = null;

    if (aObjetNonVide && aCorpsNonVide) {
      const resGlobal = await traduireExtraitsParLots([sujetInitial, ...extraitsSource], sourceLang, targetLang);
      sujetTraduit = resGlobal.traductions[0];
      traductionsCorps = resGlobal.traductions.slice(1);
      targetLang = resGlobal.targetEffective;
      mettreAJourBadgeDepuisReponse(resGlobal.derniereReponse);
    } else if (aCorpsNonVide) {
      const resCorps = await traduireExtraitsParLots(extraitsSource, sourceLang, targetLang);
      traductionsCorps = resCorps.traductions;
      targetLang = resCorps.targetEffective;
      mettreAJourBadgeDepuisReponse(resCorps.derniereReponse);
    } else if (aObjetNonVide) {
      let repSubject = await envoyerMessageTraduction(sujetInitial, sourceLang, targetLang);
      if (
        sourceLang === "auto" &&
        repSubject.detectedLang &&
        languesSontEquivalentes(repSubject.detectedLang, targetLang) &&
        langueAlternance &&
        langueAlternance !== "none" &&
        !languesSontEquivalentes(langueAlternance, repSubject.detectedLang)
      ) {
        targetLang = langueAlternance;
        definirValeurSelectSiPresente(selectTarget, targetLang);
        repSubject = await envoyerMessageTraduction(sujetInitial, repSubject.detectedLang, targetLang);
      }
      mettreAJourBadgeDepuisReponse(repSubject);
      sujetTraduit = repSubject.text;
    }

    // 2.b Sauvegarde incrémentale de l'original avant écriture dans l'éditeur
    await assurerSnapshotOriginal(details, {
      capturerSujet: aObjetNonVide,
      capturerCorps: aCorpsNonVide,
      extraitsInitial: aCorpsNonVide ? extraitsSource : null
    });

    // 2.c Application atomique Objet + Corps
    if (sujetTraduit !== null) {
      await browser.compose.setComposeDetails(ongletActifId, { subject: sujetTraduit });
    }
    if (traductionsCorps !== null) {
      const nbInjectes = await injecterTraductionsCorpsEditeur(ongletActifId, traductionsCorps);
      if (nbInjectes === 0) {
        throw new Error("SERVICE_UNAVAILABLE");
      }
    }

    btnRestore.disabled = false;
    synchroniserLibelleBoutonTraduire();
    definirStatut("ready", "composeStatusSuccess", "Message traduit avec succès ✓");
  } catch (err) {
    console.error("[MagicTranslator:Compose] Erreur lors de la traduction :", err);
    const code = err && err.message ? err.message : "SERVICE_UNAVAILABLE";
    if (code === "SELECTION_EMPTY") {
      definirStatut("error", "errorNoText", "Aucun texte à traduire.");
    } else if (code === "PERMISSION_REQUIRED") {
      definirStatut("error", "composeStatusPermissionRequired", "Autorisation réseau requise pour traduire.");
    } else if (code === "CONSENT_REQUIRED") {
      consentementRequis = true;
      const consentBanner = document.getElementById("consent-banner");
      if (consentBanner) consentBanner.classList.remove("is-hidden");
      const btnConsentAccept = document.getElementById("btn-consent-accept");
      if (btnConsentAccept) btnConsentAccept.focus();
      definirStatut("error", "composeStatusConsentRequired", "Veuillez activer un moteur ci-dessus.");
    } else if (code === "CLEARTEXT_FORBIDDEN") {
      definirStatut("error", "composeStatusCleartextForbidden", "HTTP refusé hors localhost (HTTPS requis).");
    } else if (code === "UNAUTHORIZED") {
      definirStatut("error", "errorUnauthorized", "Clé d'API manquante ou invalide.");
    } else if (code === "RATE_LIMITED") {
      definirStatut("error", "errorRateLimited", "Trop de requêtes. Réessayez dans un instant.");
    } else if (code === "TIMEOUT") {
      definirStatut("error", "errorTimeout", "Délai dépassé. Vérifiez votre connexion.");
    } else if (code === "NETWORK") {
      definirStatut("error", "errorNetwork", "Erreur réseau. Vérifiez votre connexion.");
    } else {
      definirStatut("error", "composeStatusError", "Erreur de traduction");
    }
  } finally {
    synchroniserBoutonTraduire(false);
    if (!consentementRequis) {
      const btnTranslate = document.getElementById("btn-translate");
      if (btnTranslate && !btnTranslate.disabled) {
        btnTranslate.focus();
      }
    }
  }
}

// ── Action : Restaurer l'Original ─────────────────────────────────────────────
async function executerRestauration() {
  const btnRestore = document.getElementById("btn-restore");

  if (!etatOriginal.estTraduit) {
    return;
  }

  btnRestore.disabled = true;
  btnRestore.setAttribute("aria-busy", "true");
  definirStatut("busy", "composeStatusRestoring", "Restauration en cours…");

  try {
    const cleCoffre = `compose_orig_${ongletActifId}`;
    const patch = {};

    if (etatOriginal.sujet !== null) {
      patch.subject = etatOriginal.sujet;
    }
    if (etatOriginal.isPlainText === true && etatOriginal.corpsTexte !== null) {
      patch.plainTextBody = etatOriginal.corpsTexte;
    } else if (etatOriginal.isPlainText === false && etatOriginal.corpsHtml !== null) {
      patch.body = etatOriginal.corpsHtml;
    }

    if (Object.keys(patch).length > 0) {
      await browser.compose.setComposeDetails(ongletActifId, patch);
    }

    // Repli rétro-compatible si seule la liste plate extraitsCorps existait
    if (
      etatOriginal.corpsHtml === null &&
      etatOriginal.corpsTexte === null &&
      Array.isArray(etatOriginal.extraitsCorps) &&
      etatOriginal.extraitsCorps.length > 0
    ) {
      const nbRestaures = await injecterTraductionsCorpsEditeur(ongletActifId, etatOriginal.extraitsCorps);
      if (nbRestaures === 0) {
        throw new Error("RESTORE_FAILED");
      }
    }

    etatOriginal = {
      sujet: null,
      corpsHtml: null,
      corpsTexte: null,
      isPlainText: null,
      extraitsCorps: null,
      estTraduit: false
    };
    await supprimerCoffreOnglet(cleCoffre);

    texteSelectionne = await detecterSelection(ongletActifId);
    rafraichirEtatSelectionUI();
    synchroniserLibelleBoutonTraduire();

    btnRestore.removeAttribute("aria-busy");
    btnRestore.disabled = true;
    definirStatut("ready", "composeStatusRestored", "Texte d'origine restauré ✓");
    const btnTranslate = document.getElementById("btn-translate");
    if (btnTranslate && !btnTranslate.disabled) {
      btnTranslate.focus();
    }
  } catch (err) {
    console.error("[MagicTranslator:Compose] Erreur lors de la restauration :", err);
    btnRestore.removeAttribute("aria-busy");
    btnRestore.disabled = false;
    definirStatut("error", "composeStatusRestoreError", "Échec de la restauration.");
  }
}

// ── Initialisation au Chargement du Document ─────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  appliquerI18n();

  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      ongletActifId = tabs[0].id;
    }
  } catch (err) {
    console.warn("[MagicTranslator:Compose] Impossible d'identifier l'onglet actif :", err);
  }

  if (!ongletActifId) {
    definirStatut("error", "composeStatusNoTab", "Impossible d'accéder au message.");
    return;
  }

  await chargerBadgeMoteur();

  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((_changements, zone) => {
      if (zone === "local") {
        chargerBadgeMoteur();
      }
    });
  }

  // Restaurer l'état de traduction si déjà effectué dans cet onglet
  try {
    const cleCoffre = `compose_orig_${ongletActifId}`;
    const sauvegarde = await lireCoffreOnglet(cleCoffre);
    const btnRestore = document.getElementById("btn-restore");

    if (sauvegarde && sauvegarde.estTraduit) {
      etatOriginal = {
        sujet: sauvegarde.sujet ?? null,
        corpsHtml: sauvegarde.corpsHtml ?? null,
        corpsTexte: sauvegarde.corpsTexte ?? null,
        isPlainText: sauvegarde.isPlainText ?? null,
        extraitsCorps: Array.isArray(sauvegarde.extraitsCorps) ? sauvegarde.extraitsCorps : null,
        estTraduit: true
      };
      if (btnRestore) {
        btnRestore.disabled = false;
      }
      synchroniserLibelleBoutonTraduire();
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
      definirValeurSelectSiPresente(selectTarget, stockLang.composeLastTargetLang);
    }
  } catch {
    // Ignorer
  }

  // Détecter si une sélection est active
  texteSelectionne = await detecterSelection(ongletActifId);
  const chkSelection = document.getElementById("chk-selection");
  if (chkSelection) {
    chkSelection.addEventListener("change", rafraichirEtatSelectionUI);
  }
  rafraichirEtatSelectionUI();

  document.getElementById("btn-translate").addEventListener("click", executerTraduction);
  document.getElementById("btn-restore").addEventListener("click", executerRestauration);

  const btnSwapLang = document.getElementById("btn-swap-lang");
  const selectSource = document.getElementById("select-source");
  const selectTarget = document.getElementById("select-target");

  const majBoutonSwap = () => {
    btnSwapLang.disabled = selectSource.value === "auto";
  };
  selectSource.addEventListener("change", majBoutonSwap);
  majBoutonSwap();

  btnSwapLang.addEventListener("click", () => {
    const srcVal = selectSource.value;
    const tgtVal = selectTarget.value;
    if (srcVal !== "auto") {
      definirValeurSelectSiPresente(selectSource, tgtVal);
      definirValeurSelectSiPresente(selectTarget, srcVal);
    }
  });

  document.getElementById("btn-provider-badge").addEventListener("click", async () => {
    if (!aPermissionMoteur && origineRequise) {
      const accorde = await demanderAutorisation1Clic();
      if (accorde) return;
    }
    browser.runtime.openOptionsPage();
  });

  // Filet de sécurité Opt-In 1-clic dans la popup de rédaction
  const btnConsentAccept = document.getElementById("btn-consent-accept");
  const chkConsentMyMemory = document.getElementById("chk-consent-mymemory");
  if (btnConsentAccept) {
    btnConsentAccept.addEventListener("click", async () => {
      if (btnConsentAccept.disabled) return;
      btnConsentAccept.disabled = true;
      try {
        const autoriserRelais = Boolean(chkConsentMyMemory && chkConsentMyMemory.checked);
        const res = await browser.runtime.sendMessage({
          action: "acceptDefaultProvider",
          enableMyMemoryFallback: autoriserRelais
        });
        if (res && res.success) {
          consentementRequis = false;
          const consentBanner = document.getElementById("consent-banner");
          if (consentBanner) consentBanner.classList.add("is-hidden");
          await chargerBadgeMoteur();
          const btnTranslate = document.getElementById("btn-translate");
          if (btnTranslate && !btnTranslate.disabled) {
            btnTranslate.focus();
          }
          await executerTraduction();
        } else {
          definirStatut("error", "composeStatusError", "Erreur d'activation");
        }
      } catch (err) {
        console.error("[MagicTranslator:Compose] Erreur activation 1-clic :", err);
        definirStatut("error", "composeStatusError", "Erreur d'activation");
      } finally {
        btnConsentAccept.disabled = false;
      }
    });
  }

  const btnConsentOptions = document.getElementById("btn-consent-options");
  if (btnConsentOptions) {
    btnConsentOptions.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });
  }
});
