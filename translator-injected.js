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

(() => {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════
  // NETTOYAGE D'INSTANCE PRÉCÉDENTE
  // ═══════════════════════════════════════════════════════════════════════
  // Thunderbird réutilise le même document HTML entre les messages.
  // Lorsque le script est réinjecté (nouveau message), on supprime
  // l'ancienne interface et on coupe les anciens écouteurs d'événements
  // pour repartir de zéro proprement.

  nettoyerInstance();

  // ═══════════════════════════════════════════════════════════════════════
  // DICTIONNAIRES I18N
  // ═══════════════════════════════════════════════════════════════════════
  // Les chaînes sont embarquées ici car le script de contenu n'a pas accès
  // à browser.i18n.getMessage() dans le contexte messageDisplay de Thunderbird.
  // Les fichiers _locales/ servent uniquement pour les champs du manifest
  // (nom et description de l'extension).

  const I18N = {
    fr: {
      autoDetect:         "Auto-détection",
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
      tooltipCollapse:    "Replier",
      statusTranslatingChunk:  "Traduction… ({i}/{n})",
      statusTranslatedPartial: "Traduit partiellement",
      errorRateLimited:        "Trop de requêtes. Réessayez dans un instant.",
      errorServiceUnavailable: "Service de traduction indisponible. Réessayez plus tard.",
      errorTimeout:            "Délai dépassé. Vérifiez votre connexion.",
      errorNetwork:            "Erreur réseau. Vérifiez votre connexion.",
      statusAlreadyIn:         "Déjà en {lang}"
    },
    en: {
      autoDetect:         "Auto-detect",
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
      tooltipCollapse:    "Collapse",
      statusTranslatingChunk:  "Translating… ({i}/{n})",
      statusTranslatedPartial: "Partially translated",
      errorRateLimited:        "Too many requests. Try again shortly.",
      errorServiceUnavailable: "Translation service unavailable. Try again later.",
      errorTimeout:            "Request timed out. Check your connection.",
      errorNetwork:            "Network error. Check your connection.",
      statusAlreadyIn:         "Already in {lang}"
    },
    es: {
      autoDetect:         "Auto-detectar",
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
      tooltipCollapse:    "Replegar",
      statusTranslatingChunk:  "Traduciendo… ({i}/{n})",
      statusTranslatedPartial: "Traducido parcialmente",
      errorRateLimited:        "Demasiadas solicitudes. Inténtalo de nuevo en un momento.",
      errorServiceUnavailable: "Servicio de traducción no disponible. Inténtalo más tarde.",
      errorTimeout:            "Tiempo de espera agotado. Comprueba tu conexión.",
      errorNetwork:            "Error de red. Comprueba tu conexión.",
      statusAlreadyIn:         "Ya en {lang}"
    },
    de: {
      autoDetect:         "Automatische Erkennung",
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
      tooltipCollapse:    "Einklappen",
      statusTranslatingChunk:  "Übersetze… ({i}/{n})",
      statusTranslatedPartial: "Teilweise übersetzt",
      errorRateLimited:        "Zu viele Anfragen. Versuchen Sie es gleich erneut.",
      errorServiceUnavailable: "Übersetzungsdienst nicht verfügbar. Versuchen Sie es später.",
      errorTimeout:            "Zeitüberschreitung. Prüfen Sie Ihre Verbindung.",
      errorNetwork:            "Netzwerkfehler. Prüfen Sie Ihre Verbindung.",
      statusAlreadyIn:         "Bereits auf {lang}"
    },
    vi: {
      autoDetect:         "Tự động phát hiện",
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
      tooltipCollapse:    "Thu gọn",
      statusTranslatingChunk:  "Đang dịch… ({i}/{n})",
      statusTranslatedPartial: "Đã dịch một phần",
      errorRateLimited:        "Quá nhiều yêu cầu. Hãy thử lại sau giây lát.",
      errorServiceUnavailable: "Dịch vụ dịch không khả dụng. Hãy thử lại sau.",
      errorTimeout:            "Hết thời gian chờ. Kiểm tra kết nối của bạn.",
      errorNetwork:            "Lỗi mạng. Kiểm tra kết nối của bạn.",
      statusAlreadyIn:         "Đã ở {lang}"
    },
    ja: {
      autoDetect:         "自動検出",
      bannerTitle:        "Translator",
      labelFrom:          "差出語",
      labelTo:            "翻訳先",
      btnTranslate:       "翻訳",
      btnRetranslate:     "再翻訳",
      btnOriginal:        "原文",
      statusTranslating:  "翻訳中…",
      statusTranslated:   "翻訳済み",
      statusTranslatedFrom: "{lang}から翻訳",
      errorSameLanguage:  "翻訳元と翻訳先の言語が同じです。",
      errorNoText:        "翻訳するテキストがありません。",
      errorGeneric:       "エラー: {msg}",
      tooltipExpand:      "このメッセージを翻訳",
      tooltipCollapse:    "折りたたむ",
      statusTranslatingChunk:  "翻訳中… ({i}/{n})",
      statusTranslatedPartial: "部分的に翻訳しました",
      errorRateLimited:        "リクエストが多すぎます。しばらくしてから再試行してください。",
      errorServiceUnavailable: "翻訳サービスを利用できません。後でもう一度お試しください。",
      errorTimeout:            "タイムアウトしました。接続を確認してください。",
      errorNetwork:            "ネットワークエラー。接続を確認してください。",
      statusAlreadyIn:         "すでに{lang}です"
    },
    pt: {
      autoDetect:         "Auto-detecção",
      bannerTitle:        "Translator",
      labelFrom:          "DE",
      labelTo:            "PARA",
      btnTranslate:       "Traduzir",
      btnRetranslate:     "Traduzir novamente",
      btnOriginal:        "Original",
      statusTranslating:  "A traduzir…",
      statusTranslated:   "Traduzido",
      statusTranslatedFrom: "Traduzido de {lang}",
      errorSameLanguage:  "Os idiomas de origem e destino são iguais.",
      errorNoText:        "Nenhum texto para traduzir.",
      errorGeneric:       "Erro: {msg}",
      tooltipExpand:      "Traduzir esta mensagem",
      tooltipCollapse:    "Recolher",
      statusTranslatingChunk:  "A traduzir… ({i}/{n})",
      statusTranslatedPartial: "Traduzido parcialmente",
      errorRateLimited:        "Demasiados pedidos. Tente novamente daqui a pouco.",
      errorServiceUnavailable: "Serviço de tradução indisponível. Tente mais tarde.",
      errorTimeout:            "Tempo esgotado. Verifique a sua ligação.",
      errorNetwork:            "Erro de rede. Verifique a sua ligação.",
      statusAlreadyIn:         "Já em {lang}"
    }
  };

  // ── Détection de la locale de l'interface ─────────────────────────────
  // Priorité : browser.i18n → navigator.language → fallback "en"

  let LOCALE = "en";

  const detecterLocale = () => {
    try {
      if (typeof browser !== "undefined" && browser.i18n && browser.i18n.getUILanguage) {
        const code = browser.i18n.getUILanguage().split("-")[0];
        if (I18N[code]) return code;
      }
    } catch { /* non disponible dans ce contexte */ }

    const codeLang = (navigator.language || "en").split("-")[0];
    return I18N[codeLang] ? codeLang : "en";
  };

  LOCALE = detecterLocale();

  /**
   * Fonction de traduction des clés i18n internes.
   * Supporte les placeholders {clé} dans les chaînes.
   *
   * @param   {string} cle           — Clé du dictionnaire (ex: "btnTranslate")
   * @param   {Object} [remplacements] — Paires clé/valeur pour les placeholders
   * @returns {string} Chaîne traduite
   */
  const t = (cle, remplacements) => {
    const dict = I18N[LOCALE] || I18N.en;
    let msg = dict[cle] || I18N.en[cle] || cle;
    if (remplacements) {
      Object.keys(remplacements).forEach((k) => {
        msg = msg.replace("{" + k + "}", remplacements[k]);
      });
    }
    return msg;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // NOMS AFFICHABLES DES LANGUES
  // ═══════════════════════════════════════════════════════════════════════
  // Utilisé pour afficher le nom de la langue détectée dans le message
  // de statut ("Traduit depuis Français").

  const NOMS_LANGUES = {
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

  const CSS_BANDEAU = `
:host {
  all: initial;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  
  /* ── TOKENS DE DESIGN PREMIUM ── */
  --mt-bg-glass: rgba(15, 23, 42, 0.75); /* Ardoise profond translucide */
  --mt-border-glass: rgba(255, 255, 255, 0.08);
  --mt-accent-indigo: #6366f1;
  --mt-accent-indigo-hover: #818cf8;
  --mt-accent-purple: #8b5cf6;
  --mt-accent-purple-hover: #a78bfa;
  --mt-text-primary: #f8fafc;
  --mt-text-secondary: #94a3b8;
  --mt-success: #10b981;
  --mt-error: #f43f5e;
  
  /* Arrondis */
  --mt-radius-sm: 6px;
  --mt-radius-md: 10px;
  --mt-radius-full: 9999px;
  
  /* Transitions */
  --mt-duration: 250ms;
  --mt-ease-out: cubic-bezier(0.16, 1, 0.3, 1); /* Easing haut de gamme */
}

/* ── PILULE COMPACTE (ÉTAT REPLIÉ) ── */
.mt-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 8px;
  background: var(--mt-bg-glass);
  backdrop-filter: blur(12px) saturate(190%);
  -webkit-backdrop-filter: blur(12px) saturate(190%);
  border-radius: 0 0 var(--mt-radius-md) var(--mt-radius-md);
  border: 1px solid var(--mt-border-glass);
  border-top: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--mt-accent-purple-hover);
  transition: all var(--mt-duration) var(--mt-ease-out);
  user-select: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.mt-pill:hover {
  background: rgba(30, 41, 59, 0.85);
  color: #c4b5fd;
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.25);
  transform: translateY(1px); /* Légère descente d'appel */
}

.mt-pill:active {
  transform: translateY(0) scale(0.97); /* Enfoncement physique */
}

.mt-pill-icon {
  width: 18px;
  height: 18px;
  border-radius: var(--mt-radius-sm);
  background: linear-gradient(135deg, var(--mt-accent-purple), var(--mt-accent-indigo));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: white;
  font-weight: 700;
  flex-shrink: 0;
}

.mt-pill-chevron {
  font-size: 9px;
  color: var(--mt-text-secondary);
  transition: transform var(--mt-duration) var(--mt-ease-out);
}

.mt-pill:hover .mt-pill-chevron {
  transform: translateX(2px); /* Indication visuelle de déploiement */
}

.mt-pill-status {
  font-size: 11px;
  color: var(--mt-success);
}

/* ── BANDEAU DÉPLIÉ ── */
.mt-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--mt-bg-glass);
  backdrop-filter: blur(16px) saturate(190%);
  -webkit-backdrop-filter: blur(16px) saturate(190%);
  border-bottom: 1px solid var(--mt-border-glass);
  color: var(--mt-text-primary);
  font-size: 13px;
  line-height: 1.4;
  flex-wrap: wrap;
  box-sizing: border-box;
  animation: mt-slideDown var(--mt-duration) var(--mt-ease-out);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

@keyframes mt-slideDown {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Logo */
.mt-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
  color: var(--mt-accent-purple-hover);
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.mt-logo-icon {
  min-width: 28px;
  height: 20px;
  padding: 0 4px;
  border-radius: var(--mt-radius-sm);
  background: linear-gradient(135deg, var(--mt-accent-purple), var(--mt-accent-indigo));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  letter-spacing: 0.5px;
  color: white;
  font-weight: 700;
  flex-shrink: 0;
  cursor: pointer;
  transition: all var(--mt-duration) var(--mt-ease-out);
  user-select: none;
}

.mt-logo-icon:hover {
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
}

.mt-logo-icon:active {
  transform: scale(0.95);
}

/* Séparateur */
.mt-separator {
  width: 1px;
  height: 22px;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

/* Zone de contrôles */
.mt-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mt-label {
  font-size: 10px;
  color: var(--mt-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 600;
}

/* Sélecteurs de langue */
.mt-select {
  appearance: none;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--mt-radius-sm);
  color: var(--mt-text-primary);
  padding: 6px 28px 6px 10px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: all var(--mt-duration) var(--mt-ease-out);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  min-width: 100px;
}

.mt-select:hover {
  border-color: rgba(139, 92, 246, 0.4);
  background-color: rgba(255, 255, 255, 0.08);
}

.mt-select:focus {
  border-color: var(--mt-accent-purple-hover);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
  background-color: rgba(15, 23, 42, 0.9);
}

.mt-arrow {
  color: var(--mt-text-secondary);
  font-size: 14px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

/* Boutons */
.mt-btn {
  border: none;
  border-radius: var(--mt-radius-sm);
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--mt-duration) var(--mt-ease-out);
  outline: none;
  white-space: nowrap;
}

.mt-btn-translate {
  background: linear-gradient(135deg, var(--mt-accent-purple), var(--mt-accent-indigo));
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.mt-btn-translate:hover {
  background: linear-gradient(135deg, var(--mt-accent-purple-hover), var(--mt-accent-indigo-hover));
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
  transform: translateY(-1px);
}

.mt-btn-translate:active {
  transform: translateY(0) scale(0.97);
}

.mt-btn-original {
  background: rgba(255, 255, 255, 0.06);
  color: var(--mt-text-primary);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.mt-btn-original:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.15);
}

.mt-btn-original:active {
  transform: scale(0.97);
}

/* Bouton Replier */
.mt-btn-collapse {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: var(--mt-text-secondary);
  width: 28px;
  height: 28px;
  border-radius: var(--mt-radius-full);
  padding: 0;
  font-size: 12px;
  margin-left: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--mt-duration) var(--mt-ease-out);
}

.mt-btn-collapse:hover {
  color: var(--mt-accent-purple-hover);
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.3) !important;
  transform: scale(1.05);
}

.mt-btn-collapse:active {
  transform: scale(0.95);
}

/* États désactivés et accessibilité */
.mt-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.mt-btn:focus-visible,
.mt-pill:focus-visible,
.mt-logo-icon:focus-visible,
.mt-select:focus-visible {
  outline: 2px solid var(--mt-accent-purple-hover);
  outline-offset: 2px;
}

/* Statut de chargement */
.mt-status {
  font-size: 11px;
  color: var(--mt-text-secondary);
  white-space: nowrap;
}

.mt-status.error   { color: var(--mt-error); }
.mt-status.success { color: var(--mt-success); }

.mt-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-top-color: var(--mt-accent-purple-hover);
  border-radius: 50%;
  animation: mt-spin 0.6s linear infinite;
  vertical-align: middle;
  margin-right: 6px;
}

@keyframes mt-spin { to { transform: rotate(360deg); } }

.mt-hidden { display: none !important; }
`;

  // ═══════════════════════════════════════════════════════════════════════
  // LISTE DES LANGUES (sélecteurs déroulants)
  // ═══════════════════════════════════════════════════════════════════════

  // Codes proposés dans les sélecteurs, dans l'ordre d'affichage. Le libellé natif est
  // tiré de NOMS_LANGUES (source UNIQUE code→nom) — plus de double maintenance des noms.
  const CODES_LANGUES = [
    "fr", "en", "es", "de", "it", "pt", "nl", "pl", "ru", "uk",
    "ja", "ko", "zh-CN", "zh-TW", "ar", "hi", "tr", "vi", "th", "sv",
    "da", "fi", "no", "cs", "ro", "hu", "el", "he", "id", "ms"
  ];
  const LANGUES = [
    // Le libellé "auto" est remplacé par t("autoDetect") au moment de l'affichage.
    { code: "auto", label: "Auto-détection" },
    ...CODES_LANGUES.map((code) => ({ code, label: NOMS_LANGUES[code] || code }))
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
  const demanderTraduction = async (texte, source, cible) => {
    const reponse = await browser.runtime.sendMessage({
      action: "translate",
      text: texte,
      source: source,
      target: cible
    });
    if (reponse && reponse.success) {
      return { text: reponse.text, detectedLang: reponse.detectedLang || null };
    }
    throw new Error((reponse && reponse.error) || "Échec de la traduction");
  };

  // ── Codes d'erreur (background) → clés i18n pour un message clair ───────
  // Tout code inconnu retombe sur errorGeneric (affiche le message brut).
  const ERREURS_CONNUES = {
    RATE_LIMITED:        "errorRateLimited",
    SERVICE_UNAVAILABLE: "errorServiceUnavailable",
    TIMEOUT:             "errorTimeout",
    NETWORK:             "errorNetwork"
  };

  // ── Helpers de texte purs ──────────────────────────────────────────────
  // decouperLong / extraireEspaces sont définis dans mt-text.js (injecté AVANT ce
  // script, cf. background.js) et couverts par test/text.test.js. Si MTText est absent
  // (erreur de packaging), la déstructuration échoue bruyamment — c'est volontaire.
  const { decouperLong, extraireEspaces } = globalThis.MTText;

  // ═══════════════════════════════════════════════════════════════════════
  // COLLECTE DES NŒUDS TEXTE
  // ═══════════════════════════════════════════════════════════════════════
  // Parcourt le DOM avec un TreeWalker pour récupérer tous les nœuds
  // texte visibles. Ignore les balises non-textuelles (script, style, etc.)
  // et les nœuds ne contenant que des espaces.

  /** Balises dont le contenu textuel ne doit jamais être traduit. */
  const BALISES_IGNOREES = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT",
    "EMBED", "SVG", "MATH", "CODE", "TEXTAREA"
  ]);

  /**
   * Collecte tous les nœuds texte traduisibles dans un élément racine.
   *
   * @param   {Element} racine — Élément racine du parcours (document.body)
   * @returns {Text[]}         — Tableau de nœuds Text
   */
  const collecterNoeudsTexte = (racine) => {
    const noeuds = [];
    const walker = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
      acceptNode: (noeud) => {
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
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CONSTRUCTION DE L'INTERFACE
  // ═══════════════════════════════════════════════════════════════════════
  // L'UI est composée de deux états :
  //   - Pilule compacte (état par défaut) : [T ▸]
  //   - Bandeau déplié (après clic)      : [T Translator | DE [auto] → VERS [fr] [Traduire] [▴]]
  //
  // Le tout est encapsulé dans un Shadow DOM pour ne pas interférer
  // avec les styles du message affiché.

  const construireUI = () => {
    // ── Conteneur racine ────────────────────────────────────────────────
    const conteneur = document.createElement("div");
    conteneur.id = "magic-translator-root";
    conteneur.style.cssText = "position:relative;z-index:999999;";

    // ── Shadow DOM (isolation CSS) ──────────────────────────────────────
    const shadow = conteneur.attachShadow({ mode: "open" });

    const baliseStyle = document.createElement("style");
    baliseStyle.textContent = CSS_BANDEAU;
    shadow.appendChild(baliseStyle);

    // ── Pilule compacte ─────────────────────────────────────────────────
    const pilule = document.createElement("div");
    pilule.className = "mt-pill";
    pilule.title = t("tooltipExpand");
    // Accessibilité : la pilule est cliquable → exposée comme bouton focusable au clavier.
    pilule.setAttribute("role", "button");
    pilule.setAttribute("tabindex", "0");
    pilule.setAttribute("aria-label", t("tooltipExpand"));

    const iconeT = document.createElement("span");
    iconeT.className = "mt-pill-icon";
    iconeT.textContent = "MT";
    iconeT.setAttribute("aria-hidden", "true");
    pilule.appendChild(iconeT);

    const chevron = document.createElement("span");
    chevron.className = "mt-pill-chevron";
    chevron.textContent = "▸";
    chevron.setAttribute("aria-hidden", "true");
    pilule.appendChild(chevron);

    const indicateurStatut = document.createElement("span");
    indicateurStatut.className = "mt-pill-status mt-hidden";
    indicateurStatut.textContent = "✓";
    pilule.appendChild(indicateurStatut);

    shadow.appendChild(pilule);

    // ── Bandeau déplié ──────────────────────────────────────────────────
    const bandeau = document.createElement("div");
    bandeau.className = "mt-banner mt-hidden";
    bandeau.setAttribute("role", "region");
    bandeau.setAttribute("aria-label", t("bannerTitle"));

    // Logo
    const logo = document.createElement("div");
    logo.className = "mt-logo";
    const logoIcone = document.createElement("span");
    logoIcone.className = "mt-logo-icon";
    logoIcone.textContent = "MT";
    // Accessibilité : le logo replie le bandeau → bouton focusable au clavier.
    logoIcone.setAttribute("role", "button");
    logoIcone.setAttribute("tabindex", "0");
    logoIcone.setAttribute("aria-label", t("tooltipCollapse"));
    logoIcone.title = t("tooltipCollapse");
    logo.appendChild(logoIcone);
    const logoTexte = document.createElement("span");
    logoTexte.textContent = t("bannerTitle");
    logo.appendChild(logoTexte);
    bandeau.appendChild(logo);

    // Séparateur vertical
    const sep = document.createElement("div");
    sep.className = "mt-separator";
    bandeau.appendChild(sep);

    // Zone de contrôles
    const controles = document.createElement("div");
    controles.className = "mt-controls";

    // ── Sélecteur source ────────────────────────────────────────────
    const labelSource = document.createElement("label");
    labelSource.className = "mt-label";
    labelSource.textContent = t("labelFrom");
    labelSource.setAttribute("for", "mt-select-source");
    controles.appendChild(labelSource);

    const selectSource = document.createElement("select");
    selectSource.className = "mt-select";
    selectSource.id = "mt-select-source";
    selectSource.setAttribute("aria-label", t("labelFrom"));
    LANGUES.forEach((langue) => {
      const opt = document.createElement("option");
      opt.value = langue.code;
      opt.textContent = (langue.code === "auto") ? t("autoDetect") : langue.label;
      selectSource.appendChild(opt);
    });
    selectSource.value = "auto";
    controles.appendChild(selectSource);

    // ── Flèche ──────────────────────────────────────────────────────
    const fleche = document.createElement("span");
    fleche.className = "mt-arrow";
    fleche.textContent = "→";
    fleche.setAttribute("aria-hidden", "true");
    controles.appendChild(fleche);

    // ── Sélecteur cible ─────────────────────────────────────────────
    const labelCible = document.createElement("label");
    labelCible.className = "mt-label";
    labelCible.textContent = t("labelTo");
    labelCible.setAttribute("for", "mt-select-cible");
    controles.appendChild(labelCible);

    const selectCible = document.createElement("select");
    selectCible.className = "mt-select";
    selectCible.id = "mt-select-cible";
    selectCible.setAttribute("aria-label", t("labelTo"));
    // Le sélecteur cible n'inclut pas "auto" (pas de sens en cible)
    LANGUES.filter((l) => l.code !== "auto").forEach((langue) => {
      const opt = document.createElement("option");
      opt.value = langue.code;
      opt.textContent = langue.label;
      selectCible.appendChild(opt);
    });
    // Cible par défaut : on vise la langue RÉELLE de l'utilisateur, y compris régionale
    // (ex. "zh-CN") si elle figure dans la liste, sinon le code primaire, sinon "en".
    let cibleParDefaut = "en";
    try {
      const uiFull = (typeof browser !== "undefined" && browser.i18n && browser.i18n.getUILanguage)
        ? browser.i18n.getUILanguage()
        : (navigator.language || "");
      const uiPrimary = uiFull.split("-")[0];
      if (LANGUES.some((l) => l.code === uiFull)) cibleParDefaut = uiFull;
      else if (LANGUES.some((l) => l.code === uiPrimary)) cibleParDefaut = uiPrimary;
    } catch { /* on garde "en" */ }
    selectCible.value = cibleParDefaut;
    controles.appendChild(selectCible);

    // ── Bouton « Traduire » ─────────────────────────────────────────
    const btnTraduire = document.createElement("button");
    btnTraduire.className = "mt-btn mt-btn-translate";
    btnTraduire.textContent = t("btnTranslate");
    controles.appendChild(btnTraduire);

    // ── Bouton « Original » (masqué par défaut) ─────────────────────
    const btnOriginal = document.createElement("button");
    btnOriginal.className = "mt-btn mt-btn-original mt-hidden";
    btnOriginal.textContent = t("btnOriginal");
    controles.appendChild(btnOriginal);

    bandeau.appendChild(controles);

    // ── Zone de statut ──────────────────────────────────────────────
    const statut = document.createElement("span");
    statut.className = "mt-status mt-hidden";
    // Accessibilité : région live → les changements de statut sont annoncés aux lecteurs d'écran.
    statut.setAttribute("role", "status");
    statut.setAttribute("aria-live", "polite");
    statut.setAttribute("aria-atomic", "true");
    bandeau.appendChild(statut);

    // ── Bouton « Replier » ──────────────────────────────────────────
    const btnReplier = document.createElement("button");
    btnReplier.className = "mt-btn mt-btn-collapse";
    btnReplier.textContent = "▴";
    btnReplier.title = t("tooltipCollapse");
    btnReplier.setAttribute("aria-label", t("tooltipCollapse"));
    bandeau.appendChild(btnReplier);

    shadow.appendChild(bandeau);

    // ── Objet de retour (références directes aux éléments du DOM) ────
    return {
      conteneur,
      shadow,
      pilule,
      indicateurStatut,
      bandeau,
      logoIcone,
      selectSource,
      selectCible,
      btnTraduire,
      btnOriginal,
      statut,
      btnReplier
    };
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAT DE L'APPLICATION
  // ═══════════════════════════════════════════════════════════════════════

  /** Map<Text, string> — Sauvegarde des contenus originaux (null si non traduit) */
  let contenusOriginaux = null;

  /** Indique si le bandeau est actuellement déplié */
  let estDeplie = false;

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALISATION
  // ═══════════════════════════════════════════════════════════════════════

  async function initialiser() {
    const instanceId = Date.now();
    document.documentElement._mtActiveInstanceId = instanceId;

    // ── Nettoyage de l'instance précédente ───────────────────────────────
    nettoyerInstance();
    contenusOriginaux = null;
    estDeplie = false;

    // ── Détection de la locale ────────────────────────────────────────────────
    // detecterLocale() appelle browser.i18n.getUILanguage() de façon synchrone,
    // ce qui évite tout round-trip async (et donc tout risque de « Promise rejected
    // after context unloaded » lors d'une navigation rapide entre messages).
    LOCALE = detecterLocale();

    const ui = construireUI();

    // ── Insertion dans le DOM ────────────────────────────────────────────
    // On insère le conteneur en tout premier enfant du body pour que le
    // bandeau apparaisse au-dessus du contenu du message.
    // La pilule et le bandeau sont masqués par défaut : l'UI n'apparaît
    // qu'après un clic sur le bouton barre, le menu, ou le raccourci clavier.
    ui.pilule.classList.add("mt-hidden");
    ui.bandeau.classList.add("mt-hidden");

    if (document.body) {
      document.body.insertBefore(ui.conteneur, document.body.firstChild);
    } else {
      document.documentElement.insertBefore(ui.conteneur, document.documentElement.firstChild);
    }

    // ── Repli automatique respectueux ──────────────────────────────────────
    // Après une traduction réussie, le bandeau se replie en pilule au bout de 1,5 s,
    // MAIS le timer est suspendu tant que l'utilisateur survole le bandeau ou y a le
    // focus, puis reprogrammé à la sortie — ne fait pas disparaître le contexte sous
    // la souris ni au clavier.
    let repliAutoArme = false;

    const utilisateurSurLeBandeau = () =>
      ui.bandeau.matches(":hover") ||
      (ui.shadow.activeElement && ui.bandeau.contains(ui.shadow.activeElement));

    const annulerRepliAuto = () => {
      if (document.documentElement._mtTimerRepli) {
        clearTimeout(document.documentElement._mtTimerRepli);
        document.documentElement._mtTimerRepli = null;
      }
    };
    const programmerRepliAuto = () => {
      annulerRepliAuto();
      repliAutoArme = true;
      if (utilisateurSurLeBandeau()) return; // suspendu tant qu'il interagit
      document.documentElement._mtTimerRepli = setTimeout(() => {
        document.documentElement._mtTimerRepli = null;
        repliAutoArme = false;
        if (estDeplie) replier(true);
      }, 1500);
    };
    const reprogrammerSiArme = () => {
      if (repliAutoArme && estDeplie) programmerRepliAuto();
    };

    // ── Déplier / replier ───────────────────────────────────────────────

    const deplier = () => {
      annulerRepliAuto();
      estDeplie = true;
      ui.pilule.classList.add("mt-hidden");
      ui.bandeau.classList.remove("mt-hidden");
      ui.selectSource.focus();
    };

    const replier = (afficherCoche) => {
      annulerRepliAuto();
      repliAutoArme = false;
      estDeplie = false;
      ui.bandeau.classList.add("mt-hidden");
      ui.pilule.classList.remove("mt-hidden");
      if (afficherCoche) {
        ui.indicateurStatut.classList.remove("mt-hidden");
      }
      ui.pilule.focus();
    };

    ui.pilule.addEventListener("click", deplier);

    // Le logo [MT] dans le bandeau est cliquable : referme le bandeau en pilule.
    // Même effet que le bouton ▴, mais plus grande zone de clic et plus intuitif.
    ui.logoIcone.addEventListener("click", () => {
      replier(!!contenusOriginaux);
    });

    ui.btnReplier.addEventListener("click", () => {
      replier(!!contenusOriginaux);
    });

    // Activation clavier (Entrée/Espace) des éléments rôle=bouton (pilule, logo).
    const activerAuClavier = (el, action) => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          action();
        }
      });
    };
    activerAuClavier(ui.pilule, deplier);
    activerAuClavier(ui.logoIcone, () => replier(!!contenusOriginaux));

    // Suspension/reprise du repli automatique selon l'interaction de l'utilisateur.
    ui.bandeau.addEventListener("mouseenter", annulerRepliAuto);
    ui.bandeau.addEventListener("focusin", annulerRepliAuto);
    ui.bandeau.addEventListener("mouseleave", reprogrammerSiArme);
    ui.bandeau.addEventListener("focusout", reprogrammerSiArme);

    // ═════════════════════════════════════════════════════════════════════
    // LOGIQUE DE TRADUCTION
    // ═════════════════════════════════════════════════════════════════════

    const lancerTraduction = async () => {
      if (!estDeplie) deplier();

      const source = ui.selectSource.value;
      const cible  = ui.selectCible.value;

      // ── Validation ────────────────────────────────────────────────────
      if (source === cible) {
        afficherStatut(ui.statut, t("errorSameLanguage"), "error");
        return;
      }

      const noeudsTexte = collecterNoeudsTexte(document.body);
      if (noeudsTexte.length === 0) {
        afficherStatut(ui.statut, t("errorNoText"), "error");
        return;
      }

      // ── Sauvegarde des originaux (première traduction uniquement) ──────
      if (!contenusOriginaux) {
        contenusOriginaux = new Map();
        noeudsTexte.forEach((noeud) => {
          contenusOriginaux.set(noeud, noeud.textContent);
        });
      }

      // ── Verrouillage de l'interface pendant la traduction ─────────────
      ui.btnTraduire.disabled  = true;
      ui.selectSource.disabled = true;
      ui.selectCible.disabled  = true;
      afficherStatut(ui.statut, t("statusTranslating"), "loading");

      let derniereLangDetectee = null;

      try {
        // ── Séparateur unique anti-collision ─────────────────────────────
        // Jeton unique, long et alphanumérique : Google Translate le préserve tel quel
        // (il ressemble à un identifiant) et il ne contient aucun métacaractère de regex.
        // La détection de collision ET le découpage s'appuient sur EXACTEMENT le même jeton —
        // plus de divergence entre includes() et la RegExp (qui permettait un contournement
        // par espacement interne « @@ 0 @@ ») ni de \s* non borné sujet au ReDoS.
        const textContentTotal = document.body.textContent || "";
        const hex4 = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
        let SENTINEL;
        do {
          SENTINEL = "MTSEP" + hex4() + hex4() + hex4() + hex4() + hex4() + hex4();
        } while (textContentTotal.includes(SENTINEL));
        const SEPARATEUR = "\n" + SENTINEL + "\n";
        // Au découpage on retire le jeton et l'espacement qui l'entoure. C'est sans danger :
        // on n'envoie que le « cœur » de chaque nœud (sans espaces de tête/fin) et on réattache
        // les espaces d'origine à la réinjection — la regex ne peut donc pas manger d'espace
        // significatif du texte (corrige le « texte collé » avant/après les liens).
        const SEPARATEUR_RE = new RegExp("\\s*" + SENTINEL + "\\s*", "g");

        // ── Découpage en lots (chunks) ──────────────────────────────────
        // L'API Google Translate a une limite de taille par requête.
        // On regroupe les nœuds texte en lots de 4000 caractères max.
        const TAILLE_MAX_LOT = 4000;
        const lots = [];
        let lotCourant = { noeuds: [], texte: "" };

        noeudsTexte.forEach((noeud) => {
          const txt = contenusOriginaux.get(noeud);
          // Espaces de tête/fin isolés : NON envoyés à Google (qui les altère), mais réattachés
          // tels quels à la réinjection. C'est ce qui préserve l'espacement aux frontières
          // (ex. l'espace entre un mot et le lien qui suit).
          const { lead, coeur, trail } = extraireEspaces(txt);
          const tailSep = lotCourant.texte ? SEPARATEUR.length : 0;

          // Si le lot courant déborderait, on le pousse et on en crée un nouveau
          if (lotCourant.texte.length + tailSep + coeur.length > TAILLE_MAX_LOT &&
              lotCourant.noeuds.length > 0) {
            lots.push(lotCourant);
            lotCourant = { noeuds: [], texte: "" };
          }

          lotCourant.noeuds.push({ noeud, lead, trail });
          lotCourant.texte += (lotCourant.texte ? SEPARATEUR : "") + coeur;
        });

        // Dernier lot
        if (lotCourant.noeuds.length > 0) {
          lots.push(lotCourant);
        }

        // ── Traduction lot par lot ──────────────────────────────────────
        // Écriture ATOMIQUE : on accumule toutes les traductions sans toucher au DOM,
        // et on n'applique qu'à la toute fin. Si un lot échoue (réseau, service), rien
        // n'est écrit → l'e-mail reste intégralement en version d'origine (jamais
        // « à moitié traduit »). Un nœud qui échoue dans le fallback reste simplement en VO.
        const traductions = new Map(); // noeud Text → texte traduit (appliqué en fin)
        let echecsNoeuds = 0;

        for (let i = 0; i < lots.length; i++) {
          const lot = lots[i];

          // Indicateur de progression (seulement s'il y a plusieurs lots).
          if (lots.length > 1) {
            afficherStatut(ui.statut, t("statusTranslatingChunk", { i: i + 1, n: lots.length }), "loading");
          }

          // ── Nœud unique très long (> limite) : sous-découpage ───────────
          // Sans cela, l'API tronque silencieusement et l'original serait détruit.
          if (lot.noeuds.length === 1 && lot.texte.length > TAILLE_MAX_LOT) {
            const entree = lot.noeuds[0];
            const morceaux = [];
            for (const seg of decouperLong(lot.texte, TAILLE_MAX_LOT)) {
              const r = await demanderTraduction(seg, source, cible);
              if (r.detectedLang) derniereLangDetectee = r.detectedLang;
              morceaux.push(r.text);
            }
            traductions.set(entree.noeud, entree.lead + morceaux.join("").trim() + entree.trail);
            continue;
          }

          const resultat = await demanderTraduction(lot.texte, source, cible);

          if (resultat.detectedLang) {
            derniereLangDetectee = resultat.detectedLang;
          }

          if (lot.noeuds.length === 1) {
            // ── Cas nœud unique ─────────────────────────────────────────
            // On retire tout marqueur résiduel et l'espacement parasite ajouté par Google autour
            // du cœur, puis on réattache les espaces d'origine du nœud. Les retours à la ligne
            // INTERNES (e-mails en texte brut) sont conservés (trim n'enlève que l'extérieur).
            const entree = lot.noeuds[0];
            const coeurTraduit = resultat.text.replace(SEPARATEUR_RE, "").trim();
            traductions.set(entree.noeud, entree.lead + coeurTraduit + entree.trail);
          } else {
            // ── Cas multi-nœuds ─────────────────────────────────────────
            // On découpe le résultat sur notre séparateur unique et on
            // réassigne chaque partie au nœud correspondant.
            const parties = resultat.text.split(SEPARATEUR_RE);
            if (parties.length !== lot.noeuds.length) {
              console.warn("[MagicTranslator] Separator mismatch, falling back to node-by-node translation for this chunk", parties.length, lot.noeuds.length);
              for (const entree of lot.noeuds) {
                try {
                  const origTxt = contenusOriginaux.get(entree.noeud);
                  const res = await demanderTraduction(origTxt.trim(), source, cible);
                  traductions.set(entree.noeud, entree.lead + res.text.trim() + entree.trail);
                } catch (e) {
                  echecsNoeuds++;
                  console.error("[MagicTranslator] Fallback translation failed for node", e);
                  if (e.message === "RATE_LIMITED" || e.message === "NETWORK") {
                    throw e;
                  }
                }
              }
            } else {
              lot.noeuds.forEach((entree, idx) => {
                if (parties[idx] !== undefined) {
                  traductions.set(entree.noeud, entree.lead + parties[idx].trim() + entree.trail);
                }
              });
            }
          }
        }

        // ── Écriture atomique dans le DOM (tous les lots ont abouti) ──────
        if (document.documentElement._mtActiveInstanceId !== instanceId) {
          return;
        }
        traductions.forEach((texte, noeud) => {
          noeud.textContent = texte;
        });

        // ── Affichage du statut ──────────────────────────────────────────
        if (echecsNoeuds > 0) {
          afficherStatut(ui.statut, t("statusTranslatedPartial"), "error");
        } else if (source === "auto" && derniereLangDetectee && derniereLangDetectee === cible) {
          // Auto-détection : la langue détectée est déjà la cible → rien d'utile à traduire.
          const nomLang = NOMS_LANGUES[cible] || cible;
          afficherStatut(ui.statut, "✓ " + t("statusAlreadyIn", { lang: nomLang }), "success");
        } else if (derniereLangDetectee && source === "auto") {
          const nomLang = NOMS_LANGUES[derniereLangDetectee] || derniereLangDetectee;
          afficherStatut(ui.statut, "✓ " + t("statusTranslatedFrom", { lang: nomLang }), "success");
        } else {
          afficherStatut(ui.statut, "✓ " + t("statusTranslated"), "success");
        }

        ui.btnOriginal.classList.remove("mt-hidden");
        ui.btnTraduire.textContent = t("btnRetranslate");

        // ── Repli automatique respectueux (sauf en cas d'échec partiel) ──
        if (echecsNoeuds === 0) {
          programmerRepliAuto();
        }

      } catch (erreur) {
        console.error("[MagicTranslator] Erreur de traduction :", erreur);
        const cle = ERREURS_CONNUES[erreur.message];
        const msg = cle ? t(cle) : t("errorGeneric", { msg: erreur.message });
        afficherStatut(ui.statut, msg, "error");
      } finally {
        // ── Déverrouillage de l'interface ────────────────────────────────
        ui.btnTraduire.disabled  = false;
        ui.selectSource.disabled = false;
        ui.selectCible.disabled  = false;
      }
    };

    // ── Bouton « Traduire » ─────────────────────────────────────────────
    ui.btnTraduire.addEventListener("click", lancerTraduction);

    // ── Bouton « Original » — restauration du texte d'origine ───────────
    ui.btnOriginal.addEventListener("click", () => {
      if (!contenusOriginaux) return;

      // Restauration de chaque nœud texte à son contenu original
      contenusOriginaux.forEach((texte, noeud) => {
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

    // ── Raccourci clavier ─────────────────────────────────────────────────
    // Le raccourci (Alt+Shift+T par défaut, remappable) est déclaré dans le manifest
    // (clé `commands`) et géré par background.js, qui envoie « toggleBanner ». Cela
    // évite le conflit avec « rouvrir l'onglet » (Ctrl+Shift+T) et le rend visible et
    // reconfigurable dans les paramètres de Thunderbird.

    // ── Écoute du message "toggleBanner" envoyé par background.js ─────────
    // Déclenché par le clic sur le bouton barre (message_display_action)
    // ou par le menu clic droit sur ce même bouton.
    const gererMessageBg = (message) => {
      if (message && message.action === "toggleBanner") {
        const piluleVisible = !ui.pilule.classList.contains("mt-hidden");

        if (estDeplie || piluleVisible) {
          // Désactivation : masquer bandeau ET pilule
          ui.bandeau.classList.add("mt-hidden");
          ui.pilule.classList.add("mt-hidden");
          estDeplie = false;
        } else {
          // Activation : ouvrir directement le bandeau
          ui.pilule.classList.remove("mt-hidden");
          deplier();
        }
      }
    };

    document.documentElement._mtMessageListener = gererMessageBg;
    browser.runtime.onMessage.addListener(gererMessageBg);

    // ── MutationObserver — filet de sécurité ─────────────────────────────
    // Si Thunderbird remplace le contenu du body sans réinjecter le script,
    // on dtecte la disparition de notre conteneur et on réinitialise.
    const observeur = new MutationObserver(() => {
      if (document.body && !document.body.contains(ui.conteneur)) {
        observeur.disconnect();
        initialiser().catch(console.error);
      }
    });
    if (document.body) {
      observeur.observe(document.body, { childList: true });
    }
    document.documentElement._mtObserver = observeur;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Supprime l'ancienne instance de l'UI et débranche tous ses écouteurs.
   * Appelée en début de chaque initialisation et lors du premier chargement.
   */
  function nettoyerInstance() {
    document.getElementById("magic-translator-root")?.remove();
    document.documentElement._mtObserver?.disconnect();
    if (document.documentElement._mtMessageListener) {
      browser.runtime.onMessage.removeListener(document.documentElement._mtMessageListener);
    }
    if (document.documentElement._mtTimerRepli) {
      clearTimeout(document.documentElement._mtTimerRepli);
      document.documentElement._mtTimerRepli = null;
    }
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
      const spinner = document.createElement("span");
      spinner.className = "mt-spinner";
      el.appendChild(spinner);
      el.appendChild(document.createTextNode(message));
    } else if (type === "error") {
      // Erreur : icône ⚠ (information non véhiculée par la seule couleur) + classe.
      el.textContent = "⚠ " + message;
      el.classList.add("error");
    } else {
      el.textContent = message;
      if (type === "success") el.classList.add("success");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POINT D'ENTRÉE
  // ═══════════════════════════════════════════════════════════════════════
  // On attend que le DOM soit prêt avant d'initialiser l'UI.

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initialiser().catch(console.error);
    }, { once: true });
  } else {
    initialiser().catch(console.error);
  }

})();
