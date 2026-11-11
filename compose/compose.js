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
  extraitsCorps: null,
  selection: null,
  modeSelection: false,
  estTraduit: false
};
let texteSelectionne = "";
let aPermissionMoteur = true;
let estMoteurConfigure = true;
let consentementRequis = false;
let origineRequise = "";
let langueAlternance = "none";

const { decouperLong, extraireEspaces } = globalThis.MTText;

function obtenirStockageSession() {
  return (browser.storage && browser.storage.session) ? browser.storage.session : browser.storage.local;
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
  if (uiLang) {
    document.documentElement.lang = uiLang.split("-")[0];
  }

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

    if (res && res.success) {
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
  const suffixe = rep.usedFallback ? t("composeBadgeFallbackSuffix", " (secours)") : "";
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

// ── Extraction et Injection Directe des Nœuds du Corps dans l'Éditeur ──────────
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
            if (parent.hidden) return true;
            if (parent.style && typeof parent.style.display === "string" && parent.style.display.toLowerCase() === "none") return true;
            if (nom === "BLOCKQUOTE" && parent.getAttribute("type") === "cite") return true;
            if (parent.classList && (parent.classList.contains("moz-cite-prefix") || parent.classList.contains("moz-email-headers-table"))) return true;
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
            if (parent.hidden) return true;
            if (parent.style && typeof parent.style.display === "string" && parent.style.display.toLowerCase() === "none") return true;
            if (nom === "BLOCKQUOTE" && parent.getAttribute("type") === "cite") return true;
            if (parent.classList && (parent.classList.contains("moz-cite-prefix") || parent.classList.contains("moz-email-headers-table"))) return true;
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
  const SEPARATEUR_RE = new RegExp("\\s*" + SENTINEL + "\\s*", "gi");
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
    let rep = await browser.runtime.sendMessage({
      action: "translate",
      text: txt,
      source,
      target
    });
    if (!rep || !rep.success) {
      throw new Error((rep && rep.error) || "SERVICE_UNAVAILABLE");
    }
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
      const selectTarget = document.getElementById("select-target");
      if (selectTarget) selectTarget.value = target;
      rep = await browser.runtime.sendMessage({
        action: "translate",
        text: txt,
        source,
        target
      });
      if (!rep || !rep.success) {
        throw new Error((rep && rep.error) || "SERVICE_UNAVAILABLE");
      }
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
        const repSeg = await appelerTraduction(segments[sIdx], autoriserAlt && sIdx === 0);
        morceaux.push(repSeg.text);
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
  if (sessionStore !== browser.storage.local) {
    const resLocal = await browser.storage.local.get(cleCoffre);
    if (resLocal && resLocal[cleCoffre]) {
      return resLocal[cleCoffre];
    }
  }
  return null;
}

async function ecrireCoffreOnglet(cleCoffre, valeur) {
  await obtenirStockageSession().set({ [cleCoffre]: valeur });
}

async function supprimerCoffreOnglet(cleCoffre) {
  await obtenirStockageSession().remove(cleCoffre);
  if (obtenirStockageSession() !== browser.storage.local) {
    await browser.storage.local.remove(cleCoffre).catch(() => {});
  }
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
    const cleCoffre = `compose_orig_${ongletActifId}`;

    // 1. Traduction de la Sélection uniquement
    if (texteSelectionne && chkSelection && chkSelection.checked) {
      // Snapshot complet des nœuds du corps AVANT modification : garantit une restauration
      // 100 % fiable même après fermeture/réouverture de la popup (perte de sélection).
      const snapshotCorps = etatOriginal.estTraduit && etatOriginal.extraitsCorps
        ? etatOriginal.extraitsCorps
        : await extraireNoeudsCorpsEditeur(ongletActifId);

      let repSelection = await browser.runtime.sendMessage({
        action: "translate",
        text: texteSelectionne,
        source: sourceLang,
        target: targetLang
      });

      if (!repSelection || !repSelection.success) {
        throw new Error(repSelection ? repSelection.error : "SERVICE_UNAVAILABLE");
      }

      if (
        sourceLang === "auto" &&
        repSelection.detectedLang &&
        languesSontEquivalentes(repSelection.detectedLang, targetLang) &&
        langueAlternance &&
        langueAlternance !== "none" &&
        !languesSontEquivalentes(langueAlternance, repSelection.detectedLang)
      ) {
        targetLang = langueAlternance;
        selectTarget.value = targetLang;
        repSelection = await browser.runtime.sendMessage({
          action: "translate",
          text: texteSelectionne,
          source: repSelection.detectedLang,
          target: targetLang
        });
        if (!repSelection || !repSelection.success) {
          throw new Error(repSelection ? repSelection.error : "SERVICE_UNAVAILABLE");
        }
      }

      mettreAJourBadgeDepuisReponse(repSelection);
      const texteTraduit = repSelection.text;

      if (!etatOriginal.estTraduit) {
        etatOriginal = {
          sujet: null,
          extraitsCorps: snapshotCorps,
          selection: texteSelectionne,
          modeSelection: true,
          estTraduit: true
        };
        await ecrireCoffreOnglet(cleCoffre, etatOriginal);
      }

      await browser.scripting.executeScript({
        target: { tabId: ongletActifId },
        func: (traduction) => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const noeudInsere = document.createTextNode(traduction);
            range.insertNode(noeudInsere);
            const nouveauRange = document.createRange();
            nouveauRange.selectNodeContents(noeudInsere);
            sel.removeAllRanges();
            sel.addRange(nouveauRange);
          }
        },
        args: [texteTraduit]
      });

      texteSelectionne = texteTraduit;
      btnRestore.disabled = false;
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

    const sujetInitial = (etatOriginal.estTraduit && etatOriginal.sujet !== null)
      ? etatOriginal.sujet
      : (details.subject || "");
    const aObjetNonVide = Boolean(veutObjet && sujetInitial.trim());

    let extraitsSource = [];
    if (veutCorps) {
      extraitsSource = (etatOriginal.estTraduit && Array.isArray(etatOriginal.extraitsCorps))
        ? etatOriginal.extraitsCorps
        : await extraireNoeudsCorpsEditeur(ongletActifId);
    }
    const aCorpsNonVide = Boolean(veutCorps && extraitsSource.some((s) => s && s.trim()));

    if (!aObjetNonVide && !aCorpsNonVide) {
      definirStatut("error", "errorNoText", "Aucun texte à traduire.");
      return;
    }

    // 2.a Traduction en mémoire d'abord (aucune écriture partielle en cas d'échec réseau)
    let sujetTraduit = null;
    let traductionsCorps = null;

    if (aCorpsNonVide) {
      const resCorps = await traduireExtraitsParLots(extraitsSource, sourceLang, targetLang);
      traductionsCorps = resCorps.traductions;
      targetLang = resCorps.targetEffective;
      mettreAJourBadgeDepuisReponse(resCorps.derniereReponse);
    }

    if (aObjetNonVide) {
      let repSubject = await browser.runtime.sendMessage({
        action: "translate",
        text: sujetInitial,
        source: sourceLang,
        target: targetLang
      });
      if (!repSubject || !repSubject.success) {
        throw new Error(repSubject ? repSubject.error : "SERVICE_UNAVAILABLE");
      }
      if (
        !aCorpsNonVide &&
        sourceLang === "auto" &&
        repSubject.detectedLang &&
        languesSontEquivalentes(repSubject.detectedLang, targetLang) &&
        langueAlternance &&
        langueAlternance !== "none" &&
        !languesSontEquivalentes(langueAlternance, repSubject.detectedLang)
      ) {
        targetLang = langueAlternance;
        selectTarget.value = targetLang;
        repSubject = await browser.runtime.sendMessage({
          action: "translate",
          text: sujetInitial,
          source: repSubject.detectedLang,
          target: targetLang
        });
        if (!repSubject || !repSubject.success) {
          throw new Error(repSubject ? repSubject.error : "SERVICE_UNAVAILABLE");
        }
      }
      mettreAJourBadgeDepuisReponse(repSubject);
      sujetTraduit = repSubject.text;
    }

    // 2.b Sauvegarde de l'original avant écriture dans l'éditeur
    if (!etatOriginal.estTraduit) {
      etatOriginal = {
        sujet: aObjetNonVide ? sujetInitial : null,
        extraitsCorps: aCorpsNonVide ? [...extraitsSource] : null,
        selection: null,
        modeSelection: false,
        estTraduit: true
      };
      await ecrireCoffreOnglet(cleCoffre, etatOriginal);
    }

    // 2.c Application atomique Objet + Corps
    if (sujetTraduit !== null) {
      await browser.compose.setComposeDetails(ongletActifId, { subject: sujetTraduit });
    }
    if (traductionsCorps !== null) {
      await injecterTraductionsCorpsEditeur(ongletActifId, traductionsCorps);
    }

    btnRestore.disabled = false;
    definirStatut("ready", "composeStatusSuccess", "Message traduit avec succès ✓");
  } catch (err) {
    console.error("[MagicTranslator:Compose] Erreur lors de la traduction :", err);
    const code = err && err.message ? err.message : "SERVICE_UNAVAILABLE";
    if (code === "PERMISSION_REQUIRED") {
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

    if (etatOriginal.sujet !== null) {
      await browser.compose.setComposeDetails(ongletActifId, { subject: etatOriginal.sujet });
    }

    if (Array.isArray(etatOriginal.extraitsCorps) && etatOriginal.extraitsCorps.length > 0) {
      const nbRestaures = await injecterTraductionsCorpsEditeur(ongletActifId, etatOriginal.extraitsCorps);
      if (nbRestaures === 0) {
        throw new Error("RESTORE_FAILED");
      }
    } else if (etatOriginal.modeSelection && etatOriginal.selection) {
      const remplaceOk = await browser.scripting.executeScript({
        target: { tabId: ongletActifId },
        func: (original) => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(original));
            return true;
          }
          return false;
        },
        args: [etatOriginal.selection]
      });
      if (!remplaceOk || !remplaceOk[0] || !remplaceOk[0].result) {
        throw new Error("RESTORE_FAILED");
      }
    }

    if (etatOriginal.modeSelection && etatOriginal.selection) {
      texteSelectionne = etatOriginal.selection;
    }

    etatOriginal = {
      sujet: null,
      extraitsCorps: null,
      selection: null,
      modeSelection: false,
      estTraduit: false
    };
    await supprimerCoffreOnglet(cleCoffre);

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
      etatOriginal = sauvegarde;
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
    const cleMots = nbMots > 1 ? "composeSelectionCountPlural" : "composeSelectionCountSingular";
    const defautMots = nbMots > 1
      ? "Sélection active ({count} mots)"
      : "Sélection active ({count} mot)";
    txtSelectionCount.textContent = t(cleMots, defautMots, { count: nbMots });

    const chkSubject = document.getElementById("chk-subject");
    const chkBody = document.getElementById("chk-body");
    const majOptionsSelection = () => {
      const active = chkSelection.checked;
      globalOptions.classList.toggle("is-disabled", active);
      if (chkSubject) chkSubject.disabled = active;
      if (chkBody) chkBody.disabled = active;
    };
    chkSelection.addEventListener("change", majOptionsSelection);
    majOptionsSelection();
  }

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
      selectSource.value = tgtVal;
      selectTarget.value = srcVal;
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
        const autoriserRelais = Boolean(!chkConsentMyMemory || chkConsentMyMemory.checked);
        const res = await browser.runtime.sendMessage({
          action: "acceptDefaultProvider",
          enableMyMemoryFallback: autoriserRelais
        });
        if (res && res.success) {
          consentementRequis = false;
          const consentBanner = document.getElementById("consent-banner");
          if (consentBanner) consentBanner.classList.add("is-hidden");
          await chargerBadgeMoteur();
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
