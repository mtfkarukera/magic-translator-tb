/**
 * Magic Translator — Script de contenu injecté v2.0
 * ═══════════════════════════════════════════════════
 *
 * Injecté automatiquement dans le panneau de lecture natif de Thunderbird
 * par messageDisplay.registerScripts (déclaré dans background.js).
 *
 * Fonctionnalités :
 *   • Pilule compacte [T] repliée par défaut, se déplie en bandeau complet
 *   • Auto-détection de la langue source
 *   • Traduction par lots via l'API Google Translate (background.js)
 *   • Restauration du texte original en un clic
 *   • Interface i18n (fr, en, es, de, vi)
 *   • UI sombre élégante, isolée dans un Shadow DOM
 *
 * Architecture :
 *   1. IIFE pour éviter toute pollution du scope global
 *   2. Nettoyage automatique à chaque réinjection + MutationObserver de sécurité
 *   3. Dictionnaires i18n embarqués (les fichiers _locales/ servent au manifest)
 *   4. CSS injecté dans le Shadow DOM (isolation complète)
 *   5. Traduction par envoi de message au background.js via browser.runtime
 *
 * @see background.js — reçoit les requêtes et appelle Google Translate
 */

(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════
  // NETTOYAGE D'INSTANCE PRÉCÉDENTE
  // ═══════════════════════════════════════════════════════════════════════
  // Thunderbird réutilise le même document HTML entre les messages.
  // Lorsque le script est réinjecté (nouveau message), on supprime
  // l'ancienne interface et on coupe les anciens écouteurs d'événements
  // pour repartir de zéro proprement.

  var ancienConteneur = document.getElementById("magic-translator-root");
  if (ancienConteneur) ancienConteneur.remove();
  if (document.documentElement._mtAbort) {
    document.documentElement._mtAbort.abort();
  }
  if (document.documentElement._mtObserver) {
    document.documentElement._mtObserver.disconnect();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DICTIONNAIRES I18N
  // ═══════════════════════════════════════════════════════════════════════
  // Les chaînes sont embarquées ici car le script de contenu n'a pas accès
  // à browser.i18n.getMessage() dans le contexte messageDisplay de Thunderbird.
  // Les fichiers _locales/ servent uniquement pour les champs du manifest
  // (nom et description de l'extension).

  var I18N = {
    fr: {
      bannerTitle:        "Translator",
      labelFrom:          "DE",
      labelTo:            "VERS",
      btnTranslate:       "Traduire",
      btnRetranslate:     "Retraduire",
      btnOriginal:        "Original",
      statusTranslating:  "Traduction en cours…",
      statusTranslated:   "Traduit",
      statusTranslatedFrom: "Traduit depuis {lang}",
      errorSameLanguage:  "Les langues source et cible sont identiques.",
      errorNoText:        "Aucun texte à traduire.",
      errorGeneric:       "Erreur : {msg}",
      tooltipExpand:      "Traduire ce message",
      tooltipCollapse:    "Replier"
    },
    en: {
      bannerTitle:        "Translator",
      labelFrom:          "FROM",
      labelTo:            "TO",
      btnTranslate:       "Translate",
      btnRetranslate:     "Retranslate",
      btnOriginal:        "Original",
      statusTranslating:  "Translating…",
      statusTranslated:   "Translated",
      statusTranslatedFrom: "Translated from {lang}",
      errorSameLanguage:  "Source and target languages are the same.",
      errorNoText:        "No text to translate.",
      errorGeneric:       "Error: {msg}",
      tooltipExpand:      "Translate this message",
      tooltipCollapse:    "Collapse"
    },
    es: {
      bannerTitle:        "Translator",
      labelFrom:          "DE",
      labelTo:            "A",
      btnTranslate:       "Traducir",
      btnRetranslate:     "Retraducir",
      btnOriginal:        "Original",
      statusTranslating:  "Traduciendo…",
      statusTranslated:   "Traducido",
      statusTranslatedFrom: "Traducido desde {lang}",
      errorSameLanguage:  "Los idiomas de origen y destino son iguales.",
      errorNoText:        "No hay texto para traducir.",
      errorGeneric:       "Error: {msg}",
      tooltipExpand:      "Traducir este mensaje",
      tooltipCollapse:    "Replegar"
    },
    de: {
      bannerTitle:        "Translator",
      labelFrom:          "VON",
      labelTo:            "NACH",
      btnTranslate:       "Übersetzen",
      btnRetranslate:     "Erneut übersetzen",
      btnOriginal:        "Original",
      statusTranslating:  "Übersetze…",
      statusTranslated:   "Übersetzt",
      statusTranslatedFrom: "Übersetzt aus {lang}",
      errorSameLanguage:  "Quell- und Zielsprache sind identisch.",
      errorNoText:        "Kein Text zum Übersetzen.",
      errorGeneric:       "Fehler: {msg}",
      tooltipExpand:      "Diese Nachricht übersetzen",
      tooltipCollapse:    "Einklappen"
    },
    vi: {
      bannerTitle:        "Translator",
      labelFrom:          "TỪ",
      labelTo:            "SANG",
      btnTranslate:       "Dịch",
      btnRetranslate:     "Dịch lại",
      btnOriginal:        "Bản gốc",
      statusTranslating:  "Đang dịch…",
      statusTranslated:   "Đã dịch",
      statusTranslatedFrom: "Đã dịch từ {lang}",
      errorSameLanguage:  "Ngôn ngữ nguồn và đích giống nhau.",
      errorNoText:        "Không có văn bản để dịch.",
      errorGeneric:       "Lỗi: {msg}",
      tooltipExpand:      "Dịch tin nhắn này",
      tooltipCollapse:    "Thu gọn"
    }
  };

  // ── Détection de la locale de l'interface ─────────────────────────────
  // Priorité : browser.i18n → navigator.language → fallback "fr"

  function detecterLocale() {
    try {
      if (typeof browser !== "undefined" && browser.i18n && browser.i18n.getUILanguage) {
        var code = browser.i18n.getUILanguage().split("-")[0];
        if (I18N[code]) return code;
      }
    } catch { /* non disponible dans ce contexte */ }

    var codeLang = (navigator.language || "fr").split("-")[0];
    return I18N[codeLang] ? codeLang : "fr";
  }

  var LOCALE = detecterLocale();

  /**
   * Fonction de traduction des clés i18n internes.
   * Supporte les placeholders {clé} dans les chaînes.
   *
   * @param   {string} cle           — Clé du dictionnaire (ex: "btnTranslate")
   * @param   {Object} [remplacements] — Paires clé/valeur pour les placeholders
   * @returns {string} Chaîne traduite
   */
  function t(cle, remplacements) {
    var dict = I18N[LOCALE] || I18N.fr;
    var msg = dict[cle] || I18N.fr[cle] || cle;
    if (remplacements) {
      Object.keys(remplacements).forEach(function (k) {
        msg = msg.replace("{" + k + "}", remplacements[k]);
      });
    }
    return msg;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // NOMS AFFICHABLES DES LANGUES
  // ═══════════════════════════════════════════════════════════════════════
  // Utilisé pour afficher le nom de la langue détectée dans le message
  // de statut ("Traduit depuis Français").

  var NOMS_LANGUES = {
    af: "Afrikaans",    ar: "العربية",         bg: "Български",    bn: "বাংলা",
    ca: "Català",       cs: "Čeština",         da: "Dansk",        de: "Deutsch",
    el: "Ελληνικά",     en: "English",         es: "Español",      et: "Eesti",
    fa: "فارسی",         fi: "Suomi",           fr: "Français",     gu: "ગુજરાતી",
    he: "עברית",         hi: "हिन्दी",            hr: "Hrvatski",     hu: "Magyar",
    id: "Bahasa Indonesia", it: "Italiano",    ja: "日本語",        kn: "ಕನ್ನಡ",
    ko: "한국어",         lt: "Lietuvių",        lv: "Latviešu",     mk: "Македонски",
    ml: "മലയാളം",       mr: "मराठी",           ms: "Bahasa Melayu", nl: "Nederlands",
    no: "Norsk",        pl: "Polski",          pt: "Português",    ro: "Română",
    ru: "Русский",      sk: "Slovenčina",      sl: "Slovenščina",  sq: "Shqip",
    sr: "Српски",       sv: "Svenska",         sw: "Kiswahili",    ta: "தமிழ்",
    te: "తెలుగు",        th: "ไทย",             tl: "Filipino",     tr: "Türkçe",
    uk: "Українська",   ur: "اردو",            vi: "Tiếng Việt",
    "zh-CN": "中文 (简体)", "zh-TW": "中文 (繁體)"
  };

  // ═══════════════════════════════════════════════════════════════════════
  // FEUILLE DE STYLES (Shadow DOM)
  // ═══════════════════════════════════════════════════════════════════════
  // Tous les styles sont injectés dans le Shadow DOM pour une isolation
  // complète vis-à-vis du contenu du message.
  //
  // Convention de nommage : préfixe "mt-" (Magic Translator) pour éviter
  // tout conflit, même si le Shadow DOM offre déjà l'isolation.
  //
  // Palette de couleurs : dégradé sombre violet (#1a1a2e → #0f3460)
  // avec accents violets (#a78bfa, #7c3aed) et verts (#34d399).

  var CSS_BANDEAU = [

    // ── Racine du Shadow DOM ──────────────────────────────────────────
    ":host {",
    "  all: initial;",
    "  display: block;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;",
    "}",
    "",

    // ── Pilule compacte (état replié) ─────────────────────────────────
    ".mt-pill {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 5px;",
    "  padding: 3px 10px 3px 6px;",
    "  background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%);",
    "  border-radius: 0 0 8px 8px;",
    "  cursor: pointer;",
    "  font-size: 12px;",
    "  color: #a78bfa;",
    "  transition: all 0.25s ease;",
    "  user-select: none;",
    "  border: 1px solid rgba(167, 139, 250, 0.15);",
    "  border-top: none;",
    "}",
    ".mt-pill:hover {",
    "  background: linear-gradient(135deg, #1e1e3a 0%, #163868 100%);",
    "  color: #c4b5fd;",
    "  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.2);",
    "}",

    // ── Icône carrée « T » dans la pilule ─────────────────────────────
    ".mt-pill-icon {",
    "  width: 16px;",
    "  height: 16px;",
    "  border-radius: 3px;",
    "  background: linear-gradient(135deg, #a78bfa, #7c3aed);",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  font-size: 10px;",
    "  color: white;",
    "  font-weight: 700;",
    "  flex-shrink: 0;",
    "}",

    // ── Chevron et indicateur de statut dans la pilule ─────────────────
    ".mt-pill-chevron {",
    "  font-size: 9px;",
    "  transition: transform 0.25s ease;",
    "}",
    ".mt-pill-status {",
    "  font-size: 11px;",
    "  color: #34d399;",
    "}",
    "",

    // ── Bandeau déplié ────────────────────────────────────────────────
    ".mt-banner {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 10px;",
    "  padding: 7px 14px;",
    "  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);",
    "  border-bottom: 1px solid rgba(255, 255, 255, 0.08);",
    "  color: #e0e0e0;",
    "  font-size: 13px;",
    "  line-height: 1.4;",
    "  flex-wrap: wrap;",
    "  box-sizing: border-box;",
    "  animation: mt-slideDown 0.2s ease-out;",
    "}",
    "@keyframes mt-slideDown {",
    "  from { opacity: 0; transform: translateY(-8px); }",
    "  to   { opacity: 1; transform: translateY(0); }",
    "}",
    "",

    // ── Logo / titre ──────────────────────────────────────────────────
    ".mt-logo {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 6px;",
    "  font-weight: 600;",
    "  font-size: 13px;",
    "  color: #a78bfa;",
    "  letter-spacing: 0.3px;",
    "  white-space: nowrap;",
    "  flex-shrink: 0;",
    "}",
    ".mt-logo-icon {",
    "  width: 18px;",
    "  height: 18px;",
    "  border-radius: 4px;",
    "  background: linear-gradient(135deg, #a78bfa, #7c3aed);",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  font-size: 11px;",
    "  color: white;",
    "  font-weight: 700;",
    "}",
    "",

    // ── Séparateur vertical ───────────────────────────────────────────
    ".mt-separator {",
    "  width: 1px;",
    "  height: 20px;",
    "  background: rgba(255, 255, 255, 0.12);",
    "  flex-shrink: 0;",
    "}",
    "",

    // ── Zone de contrôles (sélecteurs + boutons) ──────────────────────
    ".mt-controls {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 8px;",
    "  flex-wrap: wrap;",
    "}",
    "",

    // ── Labels « DE » / « VERS » ──────────────────────────────────────
    ".mt-label {",
    "  font-size: 11px;",
    "  color: #9ca3af;",
    "  text-transform: uppercase;",
    "  letter-spacing: 0.5px;",
    "  font-weight: 500;",
    "}",
    "",

    // ── Sélecteurs de langue (apparence personnalisée) ────────────────
    ".mt-select {",
    "  appearance: none;",
    "  -webkit-appearance: none;",
    "  background: rgba(255, 255, 255, 0.06);",
    "  border: 1px solid rgba(255, 255, 255, 0.12);",
    "  border-radius: 6px;",
    "  color: #e0e0e0;",
    "  padding: 4px 24px 4px 8px;",
    "  font-size: 12px;",
    "  font-family: inherit;",
    "  cursor: pointer;",
    "  outline: none;",
    "  transition: all 0.2s ease;",
    "  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E\");",
    "  background-repeat: no-repeat;",
    "  background-position: right 8px center;",
    "  min-width: 90px;",
    "}",
    ".mt-select:hover {",
    "  border-color: rgba(167, 139, 250, 0.4);",
    "  background-color: rgba(255, 255, 255, 0.1);",
    "}",
    ".mt-select:focus {",
    "  border-color: #a78bfa;",
    "  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.2);",
    "}",
    "",

    // ── Flèche source → cible ─────────────────────────────────────────
    ".mt-arrow {",
    "  color: #6b7280;",
    "  font-size: 14px;",
    "  flex-shrink: 0;",
    "}",
    "",

    // ── Boutons (base commune) ────────────────────────────────────────
    ".mt-btn {",
    "  border: none;",
    "  border-radius: 6px;",
    "  padding: 5px 14px;",
    "  font-size: 12px;",
    "  font-weight: 600;",
    "  font-family: inherit;",
    "  cursor: pointer;",
    "  transition: all 0.2s ease;",
    "  outline: none;",
    "  white-space: nowrap;",
    "}",

    // ── Bouton « Traduire » (principal, violet) ───────────────────────
    ".mt-btn-translate {",
    "  background: linear-gradient(135deg, #7c3aed, #6d28d9);",
    "  color: white;",
    "  box-shadow: 0 1px 3px rgba(124, 58, 237, 0.3);",
    "}",
    ".mt-btn-translate:hover {",
    "  background: linear-gradient(135deg, #8b5cf6, #7c3aed);",
    "  box-shadow: 0 2px 6px rgba(124, 58, 237, 0.4);",
    "  transform: translateY(-1px);",
    "}",
    ".mt-btn-translate:active { transform: translateY(0); }",
    "",

    // ── Bouton « Original » (secondaire) ──────────────────────────────
    ".mt-btn-original {",
    "  background: rgba(255, 255, 255, 0.08);",
    "  color: #d1d5db;",
    "  border: 1px solid rgba(255, 255, 255, 0.12);",
    "}",
    ".mt-btn-original:hover {",
    "  background: rgba(255, 255, 255, 0.14);",
    "  color: #f3f4f6;",
    "}",
    "",

    // ── Bouton « Replier » (▴) ────────────────────────────────────────
    ".mt-btn-collapse {",
    "  background: transparent;",
    "  color: #6b7280;",
    "  padding: 4px 6px;",
    "  font-size: 14px;",
    "  margin-left: auto;",
    "}",
    ".mt-btn-collapse:hover { color: #a78bfa; }",
    "",

    // ── État désactivé ────────────────────────────────────────────────
    ".mt-btn:disabled {",
    "  opacity: 0.5;",
    "  cursor: not-allowed;",
    "  transform: none !important;",
    "}",
    "",

    // ── Zone de statut ────────────────────────────────────────────────
    ".mt-status {",
    "  font-size: 11px;",
    "  color: #9ca3af;",
    "  white-space: nowrap;",
    "}",
    ".mt-status.error   { color: #f87171; }",
    ".mt-status.success { color: #34d399; }",
    "",

    // ── Spinner de chargement ─────────────────────────────────────────
    ".mt-spinner {",
    "  display: inline-block;",
    "  width: 12px;",
    "  height: 12px;",
    "  border: 2px solid rgba(167, 139, 250, 0.3);",
    "  border-top-color: #a78bfa;",
    "  border-radius: 50%;",
    "  animation: mt-spin 0.6s linear infinite;",
    "  vertical-align: middle;",
    "  margin-right: 4px;",
    "}",
    "@keyframes mt-spin { to { transform: rotate(360deg); } }",
    "",

    // ── Classe utilitaire pour masquer un élément ─────────────────────
    ".mt-hidden { display: none !important; }"

  ].join("\n");

  // ═══════════════════════════════════════════════════════════════════════
  // LISTE DES LANGUES (sélecteurs déroulants)
  // ═══════════════════════════════════════════════════════════════════════

  var LANGUES = [
    { code: "auto",  label: "Auto-détection" },
    { code: "fr",    label: "Français" },
    { code: "en",    label: "English" },
    { code: "es",    label: "Español" },
    { code: "de",    label: "Deutsch" },
    { code: "it",    label: "Italiano" },
    { code: "pt",    label: "Português" },
    { code: "nl",    label: "Nederlands" },
    { code: "pl",    label: "Polski" },
    { code: "ru",    label: "Русский" },
    { code: "uk",    label: "Українська" },
    { code: "ja",    label: "日本語" },
    { code: "ko",    label: "한국어" },
    { code: "zh-CN", label: "中文 (简体)" },
    { code: "zh-TW", label: "中文 (繁體)" },
    { code: "ar",    label: "العربية" },
    { code: "hi",    label: "हिन्दी" },
    { code: "tr",    label: "Türkçe" },
    { code: "vi",    label: "Tiếng Việt" },
    { code: "th",    label: "ไทย" },
    { code: "sv",    label: "Svenska" },
    { code: "da",    label: "Dansk" },
    { code: "fi",    label: "Suomi" },
    { code: "no",    label: "Norsk" },
    { code: "cs",    label: "Čeština" },
    { code: "ro",    label: "Română" },
    { code: "hu",    label: "Magyar" },
    { code: "el",    label: "Ελληνικά" },
    { code: "he",    label: "עברית" },
    { code: "id",    label: "Bahasa Indonesia" },
    { code: "ms",    label: "Bahasa Melayu" }
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // COMMUNICATION AVEC LE BACKGROUND
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Envoie le texte au background.js pour traduction via Google Translate.
   *
   * @param   {string} texte   — Texte brut à traduire
   * @param   {string} source  — Code langue source ("auto" pour auto-détection)
   * @param   {string} cible   — Code langue cible
   * @returns {Promise<{text: string, detectedLang: string|null}>}
   * @throws  {Error} Si la traduction échoue
   */
  async function demanderTraduction(texte, source, cible) {
    var reponse = await browser.runtime.sendMessage({
      action: "translate",
      text: texte,
      source: source,
      target: cible
    });
    if (reponse && reponse.success) {
      return { text: reponse.text, detectedLang: reponse.detectedLang || null };
    }
    throw new Error((reponse && reponse.error) || "Échec de la traduction");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COLLECTE DES NŒUDS TEXTE
  // ═══════════════════════════════════════════════════════════════════════
  // Parcourt le DOM avec un TreeWalker pour récupérer tous les nœuds
  // texte visibles. Ignore les balises non-textuelles (script, style, etc.)
  // et les nœuds ne contenant que des espaces.

  /** Balises dont le contenu textuel ne doit jamais être traduit. */
  var BALISES_IGNOREES = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT",
    "EMBED", "SVG", "MATH", "CODE", "TEXTAREA"
  ]);

  /**
   * Collecte tous les nœuds texte traduisibles dans un élément racine.
   *
   * @param   {Element} racine — Élément racine du parcours (document.body)
   * @returns {Text[]}         — Tableau de nœuds Text
   */
  function collecterNoeudsTexte(racine) {
    var noeuds = [];
    var walker = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
      acceptNode: function (noeud) {
        // Ignorer les nœuds vides (espaces, retours à la ligne isolés)
        if (!noeud.textContent.trim()) return NodeFilter.FILTER_REJECT;

        // Ignorer les nœuds dans des balises non-textuelles
        if (noeud.parentElement && BALISES_IGNOREES.has(noeud.parentElement.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      noeuds.push(walker.currentNode);
    }
    return noeuds;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONSTRUCTION DE L'INTERFACE
  // ═══════════════════════════════════════════════════════════════════════
  // L'UI est composée de deux états :
  //   - Pilule compacte (état par défaut) : [T ▸]
  //   - Bandeau déplié (après clic)      : [T Translator | DE [auto] → VERS [fr] [Traduire] [▴]]
  //
  // Le tout est encapsulé dans un Shadow DOM pour ne pas interférer
  // avec les styles du message affiché.

  function construireUI() {
    // ── Conteneur racine ────────────────────────────────────────────────
    var conteneur = document.createElement("div");
    conteneur.id = "magic-translator-root";
    conteneur.style.cssText = "position:relative;z-index:999999;";

    // ── Shadow DOM (isolation CSS) ──────────────────────────────────────
    var shadow = conteneur.attachShadow({ mode: "open" });

    var baliseStyle = document.createElement("style");
    baliseStyle.textContent = CSS_BANDEAU;
    shadow.appendChild(baliseStyle);

    // ── Pilule compacte ─────────────────────────────────────────────────
    var pilule = document.createElement("div");
    pilule.className = "mt-pill";
    pilule.title = t("tooltipExpand");

    var iconeT = document.createElement("span");
    iconeT.className = "mt-pill-icon";
    iconeT.textContent = "T";
    pilule.appendChild(iconeT);

    var chevron = document.createElement("span");
    chevron.className = "mt-pill-chevron";
    chevron.textContent = "▸";
    pilule.appendChild(chevron);

    var indicateurStatut = document.createElement("span");
    indicateurStatut.className = "mt-pill-status mt-hidden";
    indicateurStatut.textContent = "✓";
    pilule.appendChild(indicateurStatut);

    shadow.appendChild(pilule);

    // ── Bandeau déplié ──────────────────────────────────────────────────
    var bandeau = document.createElement("div");
    bandeau.className = "mt-banner mt-hidden";

    // Logo
    var logo = document.createElement("div");
    logo.className = "mt-logo";
    var logoIcone = document.createElement("span");
    logoIcone.className = "mt-logo-icon";
    logoIcone.textContent = "T";
    logo.appendChild(logoIcone);
    var logoTexte = document.createElement("span");
    logoTexte.textContent = t("bannerTitle");
    logo.appendChild(logoTexte);
    bandeau.appendChild(logo);

    // Séparateur vertical
    var sep = document.createElement("div");
    sep.className = "mt-separator";
    bandeau.appendChild(sep);

    // Zone de contrôles
    var controles = document.createElement("div");
    controles.className = "mt-controls";

    // ── Sélecteur source ────────────────────────────────────────────
    var labelSource = document.createElement("span");
    labelSource.className = "mt-label";
    labelSource.textContent = t("labelFrom");
    controles.appendChild(labelSource);

    var selectSource = document.createElement("select");
    selectSource.className = "mt-select";
    LANGUES.forEach(function (langue) {
      var opt = document.createElement("option");
      opt.value = langue.code;
      opt.textContent = langue.label;
      selectSource.appendChild(opt);
    });
    selectSource.value = "auto";
    controles.appendChild(selectSource);

    // ── Flèche ──────────────────────────────────────────────────────
    var fleche = document.createElement("span");
    fleche.className = "mt-arrow";
    fleche.textContent = "→";
    controles.appendChild(fleche);

    // ── Sélecteur cible ─────────────────────────────────────────────
    var labelCible = document.createElement("span");
    labelCible.className = "mt-label";
    labelCible.textContent = t("labelTo");
    controles.appendChild(labelCible);

    var selectCible = document.createElement("select");
    selectCible.className = "mt-select";
    // Le sélecteur cible n'inclut pas "auto" (pas de sens en cible)
    LANGUES.filter(function (l) { return l.code !== "auto"; }).forEach(function (langue) {
      var opt = document.createElement("option");
      opt.value = langue.code;
      opt.textContent = langue.label;
      selectCible.appendChild(opt);
    });
    // Pré-sélectionner la langue de l'interface, sinon "fr"
    var cibleParDefaut = LOCALE;
    var cibleExiste = LANGUES.some(function (l) { return l.code === cibleParDefaut; });
    selectCible.value = cibleExiste ? cibleParDefaut : "fr";
    controles.appendChild(selectCible);

    // ── Bouton « Traduire » ─────────────────────────────────────────
    var btnTraduire = document.createElement("button");
    btnTraduire.className = "mt-btn mt-btn-translate";
    btnTraduire.textContent = t("btnTranslate");
    controles.appendChild(btnTraduire);

    // ── Bouton « Original » (masqué par défaut) ─────────────────────
    var btnOriginal = document.createElement("button");
    btnOriginal.className = "mt-btn mt-btn-original mt-hidden";
    btnOriginal.textContent = t("btnOriginal");
    controles.appendChild(btnOriginal);

    bandeau.appendChild(controles);

    // ── Zone de statut ──────────────────────────────────────────────
    var statut = document.createElement("span");
    statut.className = "mt-status mt-hidden";
    bandeau.appendChild(statut);

    // ── Bouton « Replier » ──────────────────────────────────────────
    var btnReplier = document.createElement("button");
    btnReplier.className = "mt-btn mt-btn-collapse";
    btnReplier.textContent = "▴";
    btnReplier.title = t("tooltipCollapse");
    bandeau.appendChild(btnReplier);

    shadow.appendChild(bandeau);

    // ── Objet de retour (références directes aux éléments du DOM) ────
    return {
      conteneur:        conteneur,
      pilule:           pilule,
      indicateurStatut: indicateurStatut,
      bandeau:          bandeau,
      selectSource:     selectSource,
      selectCible:      selectCible,
      btnTraduire:      btnTraduire,
      btnOriginal:      btnOriginal,
      statut:           statut,
      btnReplier:       btnReplier
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAT DE L'APPLICATION
  // ═══════════════════════════════════════════════════════════════════════

  /** Map<Text, string> — Sauvegarde des contenus originaux (null si non traduit) */
  var contenusOriginaux = null;

  /** Indique si le bandeau est actuellement déplié */
  var estDeplie = false;

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALISATION
  // ═══════════════════════════════════════════════════════════════════════

  function initialiser() {
    // ── Nettoyage si réinitialisation (via MutationObserver) ─────────────
    var ancienUI = document.getElementById("magic-translator-root");
    if (ancienUI) ancienUI.remove();
    if (document.documentElement._mtAbort) {
      document.documentElement._mtAbort.abort();
    }
    if (document.documentElement._mtObserver) {
      document.documentElement._mtObserver.disconnect();
    }
    contenusOriginaux = null;
    estDeplie = false;

    // ── Contrôleur d'annulation (nettoyage des écouteurs document) ──────
    var controleur = new AbortController();
    document.documentElement._mtAbort = controleur;

    var ui = construireUI();

    // ── Insertion dans le DOM ────────────────────────────────────────────
    // On insère le conteneur en tout premier enfant du body pour que le
    // bandeau apparaisse au-dessus du contenu du message.
    // La pilule et le bandeau sont masqués par défaut : l'UI n'apparaît
    // qu'après un clic explicite sur le bouton barre ou Ctrl+Shift+T.
    ui.pilule.classList.add("mt-hidden");
    ui.bandeau.classList.add("mt-hidden");

    if (document.body) {
      document.body.insertBefore(ui.conteneur, document.body.firstChild);
    } else {
      document.documentElement.insertBefore(ui.conteneur, document.documentElement.firstChild);
    }

    // ── Déplier / replier ───────────────────────────────────────────────

    function deplier() {
      estDeplie = true;
      ui.pilule.classList.add("mt-hidden");
      ui.bandeau.classList.remove("mt-hidden");
    }

    function replier(afficherCoche) {
      estDeplie = false;
      ui.bandeau.classList.add("mt-hidden");
      ui.pilule.classList.remove("mt-hidden");
      if (afficherCoche) {
        ui.indicateurStatut.classList.remove("mt-hidden");
      }
    }

    ui.pilule.addEventListener("click", deplier);
    ui.btnReplier.addEventListener("click", function () {
      replier(!!contenusOriginaux);
    });

    // ═════════════════════════════════════════════════════════════════════
    // LOGIQUE DE TRADUCTION
    // ═════════════════════════════════════════════════════════════════════

    async function lancerTraduction() {
      if (!estDeplie) deplier();

      var source = ui.selectSource.value;
      var cible  = ui.selectCible.value;

      // ── Validation ────────────────────────────────────────────────────
      if (source === cible) {
        afficherStatut(ui.statut, t("errorSameLanguage"), "error");
        return;
      }

      var noeudsTexte = collecterNoeudsTexte(document.body);
      if (noeudsTexte.length === 0) {
        afficherStatut(ui.statut, t("errorNoText"), "error");
        return;
      }

      // ── Sauvegarde des originaux (première traduction uniquement) ──────
      if (!contenusOriginaux) {
        contenusOriginaux = new Map();
        noeudsTexte.forEach(function (noeud) {
          contenusOriginaux.set(noeud, noeud.textContent);
        });
      }

      // ── Verrouillage de l'interface pendant la traduction ─────────────
      ui.btnTraduire.disabled  = true;
      ui.selectSource.disabled = true;
      ui.selectCible.disabled  = true;
      afficherStatut(ui.statut, t("statusTranslating"), "loading");

      var derniereLangDetectee = null;

      try {
        // ── Séparateur unique pour les lots multi-nœuds ─────────────────
        // IMPORTANT : On ne peut PAS utiliser "\n" comme séparateur car les
        // e-mails en texte brut (<pre>) contiennent un seul nœud texte avec
        // des \n à l'intérieur. Si on découpe par \n après traduction, on
        // perd tout le contenu après la première ligne.
        // On utilise "|||MT|||" que Google Translate laisse intact.
        // IMPORTANT : @@MTBRK@@ était modifié par Google Translate en @@VTTRK@@.
        // @@0@@ (chiffre seul) est garanti intact par tous les moteurs de traduction.
        var SEPARATEUR     = "\n@@0@@\n";
        var SEPARATEUR_RE  = /\n?@@0@@\n?/;

        // ── Découpage en lots (chunks) ──────────────────────────────────
        // L'API Google Translate a une limite de taille par requête.
        // On regroupe les nœuds texte en lots de 4000 caractères max.
        var TAILLE_MAX_LOT = 4000;
        var lots = [];
        var lotCourant = { noeuds: [], texte: "" };

        noeudsTexte.forEach(function (noeud) {
          var txt = noeud.textContent;
          var tailSep = lotCourant.texte ? SEPARATEUR.length : 0;

          // Si le lot courant déborderait, on le pousse et on en crée un nouveau
          if (lotCourant.texte.length + tailSep + txt.length > TAILLE_MAX_LOT &&
              lotCourant.noeuds.length > 0) {
            lots.push(lotCourant);
            lotCourant = { noeuds: [], texte: "" };
          }

          lotCourant.noeuds.push({ noeud: noeud });
          lotCourant.texte += (lotCourant.texte ? SEPARATEUR : "") + txt;
        });

        // Dernier lot
        if (lotCourant.noeuds.length > 0) {
          lots.push(lotCourant);
        }

        // ── Traduction lot par lot ──────────────────────────────────────
        for (var i = 0; i < lots.length; i++) {
          var lot = lots[i];
          var resultat = await demanderTraduction(lot.texte, source, cible);

          if (resultat.detectedLang) {
            derniereLangDetectee = resultat.detectedLang;
          }

          if (lot.noeuds.length === 1) {
            // ── Cas nœud unique ─────────────────────────────────────────
            // Assignation directe du texte traduit complet. Cela préserve
            // les retours à la ligne internes (e-mails en texte brut).
            // On nettoie d'éventuels marqueurs résiduels par sécurité.
            lot.noeuds[0].noeud.textContent = resultat.text.replace(SEPARATEUR_RE, "\n");
          } else {
            // ── Cas multi-nœuds ─────────────────────────────────────────
            // On découpe le résultat sur notre séparateur unique et on
            // réassigne chaque partie au nœud correspondant.
            var parties = resultat.text.split(SEPARATEUR_RE);
            lot.noeuds.forEach(function (entree, idx) {
              if (parties[idx] !== undefined) {
                entree.noeud.textContent = parties[idx];
              }
            });
          }
        }

        // ── Affichage du statut de succès ────────────────────────────────
        if (derniereLangDetectee && source === "auto") {
          var nomLang = NOMS_LANGUES[derniereLangDetectee] || derniereLangDetectee;
          afficherStatut(ui.statut, "✓ " + t("statusTranslatedFrom", { lang: nomLang }), "success");
        } else {
          afficherStatut(ui.statut, "✓ " + t("statusTranslated"), "success");
        }

        ui.btnOriginal.classList.remove("mt-hidden");
        ui.btnTraduire.textContent = t("btnRetranslate");

        // ── Repli automatique après 1,5 s ───────────────────────────────
        setTimeout(function () {
          if (estDeplie) replier(true);
        }, 1500);

      } catch (erreur) {
        console.error("[MagicTranslator] Erreur de traduction :", erreur);
        afficherStatut(ui.statut, t("errorGeneric", { msg: erreur.message }), "error");
      } finally {
        // ── Déverrouillage de l'interface ────────────────────────────────
        ui.btnTraduire.disabled  = false;
        ui.selectSource.disabled = false;
        ui.selectCible.disabled  = false;
      }
    }

    // ── Bouton « Traduire » ─────────────────────────────────────────────
    ui.btnTraduire.addEventListener("click", lancerTraduction);

    // ── Bouton « Original » — restauration du texte d'origine ───────────
    ui.btnOriginal.addEventListener("click", function () {
      if (!contenusOriginaux) return;

      // Restauration de chaque nœud texte à son contenu original
      contenusOriginaux.forEach(function (texte, noeud) {
        noeud.textContent = texte;
      });

      // Réinitialisation de l'état
      contenusOriginaux = null;
      ui.btnOriginal.classList.add("mt-hidden");
      ui.btnTraduire.textContent = t("btnTranslate");
      ui.indicateurStatut.classList.add("mt-hidden");
      afficherStatut(ui.statut, "", "");
      ui.statut.classList.add("mt-hidden");
    });

    // ── Raccourci clavier (Ctrl+Shift+T directement dans le document) ────
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === "T" || e.key === "t")) {
        e.preventDefault();
        lancerTraduction();
      }
    }, { signal: controleur.signal });

    // ── Écoute du message "toggleBanner" envoyé par background.js ─────────
    // Déclenché par le clic sur le bouton barre (message_display_action)
    // ou par le menu clic droit sur ce même bouton.
    // Comportement toggle : ouvre le bandeau si fermé, le ferme sinon.
    function gererMessageBg(message) {
      if (message && message.action === "toggleBanner") {
        if (estDeplie) {
          replier(!!contenusOriginaux);
        } else {
          // S'assurer que la pilule est visible avant de déplier
          ui.pilule.classList.remove("mt-hidden");
          deplier();
        }
      }
    }
    browser.runtime.onMessage.addListener(gererMessageBg);

    // ── MutationObserver — filet de sécurité ─────────────────────────────
    // Si Thunderbird remplace le contenu du body sans réinjecter le script,
    // on détecte la disparition de notre conteneur et on réinitialise.
    var observeur = new MutationObserver(function () {
      if (document.body && !document.body.contains(ui.conteneur)) {
        observeur.disconnect();
        initialiser();
      }
    });
    if (document.body) {
      observeur.observe(document.body, { childList: true });
    }
    document.documentElement._mtObserver = observeur;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AFFICHAGE DU STATUT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Met à jour la zone de statut dans le bandeau.
   *
   * @param {HTMLElement} el      — Élément DOM du statut
   * @param {string}      message — Message à afficher (vide = masquer)
   * @param {string}      type    — "loading" | "error" | "success" | ""
   */
  function afficherStatut(el, message, type) {
    el.classList.remove("mt-hidden", "error", "success");
    el.textContent = "";

    if (!message) {
      el.classList.add("mt-hidden");
      return;
    }

    if (type === "loading") {
      // Ajout d'un spinner animé avant le texte
      var spinner = document.createElement("span");
      spinner.className = "mt-spinner";
      el.appendChild(spinner);
      el.appendChild(document.createTextNode(message));
    } else {
      el.textContent = message;
      if (type === "error")   el.classList.add("error");
      if (type === "success") el.classList.add("success");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POINT D'ENTRÉE
  // ═══════════════════════════════════════════════════════════════════════
  // On attend que le DOM soit prêt avant d'initialiser l'UI.

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiser, { once: true });
  } else {
    initialiser();
  }

})();
