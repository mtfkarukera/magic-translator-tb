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

  // [M-R1] Suppression du double nettoyerInstance() : un seul appel dans initialiser() suffit.
  // L'appel ici était redondant et créait un risque de race condition en cas de récursion
  // via le MutationObserver (le second appel détachait des listeners fraichement enregistrés).
  // nettoyerInstance(); ← supprimé, conservé uniquement dans initialiser()

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
      bannerTitle:        "Magic Translator",
      labelFrom:          "DE",
      labelTo:            "VERS",
      ariaSelectSource:   "Langue source",
      ariaSelectTarget:   "Langue cible",
      ariaConsentRegion:  "Consentement du moteur de traduction",
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
      errorUnauthorized:       "Clé d'API manquante ou invalide. Cliquez sur le badge ⚙️ pour vérifier les réglages.",
      errorPermissionRequired: "Permission requise pour {provider} : Cliquez sur le badge ⚙️ pour ouvrir les réglages.",
      errorConsentRequired:    "Veuillez activer un moteur de traduction ci-dessus pour commencer.",
      errorCleartextForbidden: "Connexion HTTP non chiffrée refusée (politique Mozilla Thunderbird : HTTPS requis hors localhost).",
      consentPrompt:           "Aucun moteur de traduction n'est encore activé. La traduction envoie le texte de l'e-mail au fournisseur choisi :",
      consentFallbackCheckbox: "Relais MyMemory en secours",
      btnConsentAccept:        "✓ Activer Google et traduire",
      btnConsentOptions:       "⚙️ Autre moteur…",
      badgeUnconfigured:       "À activer",
      badgeActiveTitle:        "Moteur actif : {provider} (Modifier dans les paramètres)",
      badgeActiveAria:         "Paramètres du moteur : {provider}",
      badgePermWarningTitle:   "Moteur actif : {provider} (Accès réseau requis — Cliquez pour ouvrir les réglages)",
      badgePermWarningAria:    "Accès réseau requis pour {provider}",
      badgeKeyWarningTitle:    "Moteur actif : {provider} (Clé d'API requise — Cliquez pour ouvrir les réglages)",
      badgeKeyWarningAria:     "Clé d'API requise pour {provider}",
      badgeFallbackSuffix:     " (secours)",
      statusAlreadyIn:         "Déjà en {lang}",
      statusTranslatedAlternate: "Traduit vers {lang} (cible d'alternance)"
    },
    en: {
      autoDetect:         "Auto-detect",
      bannerTitle:        "Magic Translator",
      labelFrom:          "FROM",
      labelTo:            "TO",
      ariaSelectSource:   "Source language",
      ariaSelectTarget:   "Target language",
      ariaConsentRegion:  "Translation provider consent",
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
      errorUnauthorized:       "Missing or invalid API key. Click the ⚙️ badge to check settings.",
      errorPermissionRequired: "Permission required for {provider}: Click the ⚙️ badge to open settings.",
      errorConsentRequired:    "Please enable a translation provider above to start.",
      errorCleartextForbidden: "Unencrypted HTTP connection refused (Mozilla Thunderbird policy: HTTPS required outside localhost).",
      consentPrompt:           "No translation provider is enabled yet. Translating sends the email text to the chosen provider:",
      consentFallbackCheckbox: "MyMemory fallback relay",
      btnConsentAccept:        "✓ Enable Google & translate",
      btnConsentOptions:       "⚙️ Other provider…",
      badgeUnconfigured:       "Setup required",
      badgeActiveTitle:        "Active provider: {provider} (Change in settings)",
      badgeActiveAria:         "Provider settings: {provider}",
      badgePermWarningTitle:   "Active provider: {provider} (Network access required — Click to open settings)",
      badgePermWarningAria:    "Network access required for {provider}",
      badgeKeyWarningTitle:    "Active provider: {provider} (API key required — Click to open settings)",
      badgeKeyWarningAria:     "API key required for {provider}",
      badgeFallbackSuffix:     " (fallback)",
      statusAlreadyIn:         "Already in {lang}",
      statusTranslatedAlternate: "Translated to {lang} (alternate target)"
    },
    es: {
      autoDetect:         "Auto-detectar",
      bannerTitle:        "Magic Translator",
      labelFrom:          "DE",
      labelTo:            "A",
      ariaSelectSource:   "Idioma de origen",
      ariaSelectTarget:   "Idioma de destino",
      ariaConsentRegion:  "Consentimiento del motor de traducción",
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
      errorUnauthorized:       "Clave API faltante o no válida. Haz clic en la insignia ⚙️ para revisar los ajustes.",
      errorPermissionRequired: "Permiso requerido para {provider}: Haz clic en la insignia ⚙️ para abrir los ajustes.",
      errorConsentRequired:    "Activa un proveedor de traducción arriba para comenzar.",
      errorCleartextForbidden: "Conexión HTTP sin cifrar rechazada (política de Mozilla Thunderbird: se requiere HTTPS fuera de localhost).",
      consentPrompt:           "Aún no hay ningún motor de traducción activo. Al traducir, el texto del correo se envía al proveedor elegido:",
      consentFallbackCheckbox: "Relevo MyMemory de respaldo",
      btnConsentAccept:        "✓ Activar Google y traducir",
      btnConsentOptions:       "⚙️ Otro motor…",
      badgeUnconfigured:       "Configurar",
      badgeActiveTitle:        "Motor activo: {provider} (Cambiar en ajustes)",
      badgeActiveAria:         "Ajustes del motor: {provider}",
      badgePermWarningTitle:   "Motor activo: {provider} (Permiso de red requerido — Haz clic para abrir ajustes)",
      badgePermWarningAria:    "Permiso de red requerido para {provider}",
      badgeKeyWarningTitle:    "Motor activo: {provider} (Clave API requerida — Haz clic para abrir ajustes)",
      badgeKeyWarningAria:     "Clave API requerida para {provider}",
      badgeFallbackSuffix:     " (respaldo)",
      statusAlreadyIn:         "Ya en {lang}",
      statusTranslatedAlternate: "Traducido al {lang} (destino alternativo)"
    },
    de: {
      autoDetect:         "Automatische Erkennung",
      bannerTitle:        "Magic Translator",
      labelFrom:          "VON",
      labelTo:            "NACH",
      ariaSelectSource:   "Quellsprache",
      ariaSelectTarget:   "Zielsprache",
      ariaConsentRegion:  "Zustimmung zum Übersetzungsdienst",
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
      errorUnauthorized:       "Fehlender oder ungültiger API-Schlüssel. Klicken Sie auf das ⚙️-Badge, um die Einstellungen zu prüfen.",
      errorPermissionRequired: "Berechtigung für {provider} erforderlich: Klicken Sie auf das ⚙️-Badge, um die Einstellungen zu öffnen.",
      errorConsentRequired:    "Bitte aktivieren Sie oben einen Übersetzungsdienst, um zu beginnen.",
      errorCleartextForbidden: "Unverschlüsselte HTTP-Verbindung abgelehnt (Mozilla Thunderbird-Richtlinie: HTTPS außerhalb von localhost erforderlich).",
      consentPrompt:           "Es ist noch kein Übersetzungsdienst aktiviert. Beim Übersetzen wird der E-Mail-Text an den gewählten Dienst gesendet:",
      consentFallbackCheckbox: "MyMemory-Ersatzdienst",
      btnConsentAccept:        "✓ Google aktivieren & übersetzen",
      btnConsentOptions:       "⚙️ Anderer Dienst…",
      badgeUnconfigured:       "Einrichten",
      badgeActiveTitle:        "Aktiver Dienst: {provider} (In den Einstellungen ändern)",
      badgeActiveAria:         "Diensteinstellungen: {provider}",
      badgePermWarningTitle:   "Aktiver Dienst: {provider} (Netzwerkzugriff erforderlich — Klicken für Einstellungen)",
      badgePermWarningAria:    "Netzwerkzugriff erforderlich für {provider}",
      badgeKeyWarningTitle:    "Aktiver Dienst: {provider} (API-Schlüssel erforderlich — Klicken für Einstellungen)",
      badgeKeyWarningAria:     "API-Schlüssel erforderlich für {provider}",
      badgeFallbackSuffix:     " (Ersatz)",
      statusAlreadyIn:         "Bereits auf {lang}",
      statusTranslatedAlternate: "Übersetzt nach {lang} (Alternative)"
    },
    vi: {
      autoDetect:         "Tự động phát hiện",
      bannerTitle:        "Magic Translator",
      labelFrom:          "TỪ",
      labelTo:            "SANG",
      ariaSelectSource:   "Ngôn ngữ nguồn",
      ariaSelectTarget:   "Ngôn ngữ đích",
      ariaConsentRegion:  "Đồng ý chọn công cụ dịch",
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
      errorUnauthorized:       "Thiếu hoặc sai khóa API. Nhấp vào huy hiệu ⚙️ để kiểm tra cài đặt.",
      errorPermissionRequired: "Cần quyền cho {provider}: Nhấp vào huy hiệu ⚙️ để mở cài đặt.",
      errorConsentRequired:    "Vui lòng kích hoạt một công cụ dịch ở trên để bắt đầu.",
      errorCleartextForbidden: "Kết nối HTTP không mã hóa bị từ chối (chính sách Mozilla Thunderbird: bắt buộc HTTPS ngoài localhost).",
      consentPrompt:           "Chưa có công cụ dịch nào được bật. Việc dịch sẽ gửi nội dung email đến nhà cung cấp đã chọn:",
      consentFallbackCheckbox: "Dự phòng qua MyMemory",
      btnConsentAccept:        "✓ Bật Google & dịch",
      btnConsentOptions:       "⚙️ Công cụ khác…",
      badgeUnconfigured:       "Cần thiết lập",
      badgeActiveTitle:        "Công cụ đang dùng: {provider} (Đổi trong cài đặt)",
      badgeActiveAria:         "Cài đặt công cụ: {provider}",
      badgePermWarningTitle:   "Công cụ đang dùng: {provider} (Cần quyền mạng — Nhấp để mở cài đặt)",
      badgePermWarningAria:    "Cần quyền mạng cho {provider}",
      badgeKeyWarningTitle:    "Công cụ đang dùng: {provider} (Cần khóa API — Nhấp để mở cài đặt)",
      badgeKeyWarningAria:     "Cần khóa API cho {provider}",
      badgeFallbackSuffix:     " (dự phòng)",
      statusAlreadyIn:         "Đã ở {lang}",
      statusTranslatedAlternate: "Đã dịch sang {lang} (ngôn ngữ thay thế)"
    },
    ja: {
      autoDetect:         "自動検出",
      bannerTitle:        "Magic Translator",
      labelFrom:          "差出語",
      labelTo:            "翻訳先",
      ariaSelectSource:   "翻訳元の言語",
      ariaSelectTarget:   "翻訳先の言語",
      ariaConsentRegion:  "翻訳エンジンの同意設定",
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
      errorUnauthorized:       "APIキーが未入力または無効です。⚙️バッジをクリックして設定を確認してください。",
      errorPermissionRequired: "{provider}の権限が必要です：⚙️バッジをクリックして設定を開いてください。",
      errorConsentRequired:    "開始するには、上で翻訳エンジンを有効にしてください。",
      errorCleartextForbidden: "暗号化されていないHTTP接続は拒否されました（Mozilla Thunderbirdポリシー：localhost以外はHTTPS必須）。",
      consentPrompt:           "翻訳エンジンがまだ有効になっていません。翻訳を実行すると、メール本文が選択したプロバイダーに送信されます：",
      consentFallbackCheckbox: "MyMemoryを予備として使用",
      btnConsentAccept:        "✓ Googleを有効にして翻訳",
      btnConsentOptions:       "⚙️ 他のエンジン…",
      badgeUnconfigured:       "未設定",
      badgeActiveTitle:        "使用中のエンジン: {provider}（設定で変更）",
      badgeActiveAria:         "翻訳エンジンの設定: {provider}",
      badgePermWarningTitle:   "使用中のエンジン: {provider}（ネットワーク権限が必要 — クリックして設定を開く）",
      badgePermWarningAria:    "{provider}のネットワーク権限が必要です",
      badgeKeyWarningTitle:    "使用中のエンジン: {provider}（APIキーが必要 — クリックして設定を開く）",
      badgeKeyWarningAria:     "{provider}のAPIキーが必要です",
      badgeFallbackSuffix:     "（予備）",
      statusAlreadyIn:         "すでに{lang}です",
      statusTranslatedAlternate: "{lang}へ翻訳（代替）"
    },
    pt: {
      autoDetect:         "Auto-detecção",
      bannerTitle:        "Magic Translator",
      labelFrom:          "DE",
      labelTo:            "PARA",
      ariaSelectSource:   "Idioma de origem",
      ariaSelectTarget:   "Idioma de destino",
      ariaConsentRegion:  "Consentimento do motor de tradução",
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
      errorUnauthorized:       "Chave de API em falta ou inválida. Clique no selo ⚙️ para verificar as definições.",
      errorPermissionRequired: "Permissão necessária para {provider}: Clique no selo ⚙️ para abrir as definições.",
      errorConsentRequired:    "Ative um motor de tradução acima para começar.",
      errorCleartextForbidden: "Ligação HTTP não encriptada recusada (política Mozilla Thunderbird: HTTPS obrigatório fora de localhost).",
      consentPrompt:           "Nenhum motor de tradução está ativo. A tradução envia o texto do e-mail para o fornecedor escolhido:",
      consentFallbackCheckbox: "Retransmissão MyMemory de recurso",
      btnConsentAccept:        "✓ Ativar Google e traduzir",
      btnConsentOptions:       "⚙️ Outro motor…",
      badgeUnconfigured:       "Configurar",
      badgeActiveTitle:        "Motor ativo: {provider} (Alterar nas definições)",
      badgeActiveAria:         "Definições do motor: {provider}",
      badgePermWarningTitle:   "Motor ativo: {provider} (Permissão de rede necessária — Clique para abrir definições)",
      badgePermWarningAria:    "Permissão de rede necessária para {provider}",
      badgeKeyWarningTitle:    "Motor ativo: {provider} (Chave de API necessária — Clique para abrir definições)",
      badgeKeyWarningAria:     "Chave de API necessária para {provider}",
      badgeFallbackSuffix:     " (recurso)",
      statusAlreadyIn:         "Já em {lang}",
      statusTranslatedAlternate: "Traduzido para {lang} (destino alternativo)"
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
  color-scheme: light dark;
  
  /* ── TOKENS DE DESIGN PREMIUM (WCAG AA >= 4.5:1 garanti même sur fond d'e-mail clair) ── */
  --mt-bg-glass: rgba(15, 23, 42, 0.93);
  --mt-border-glass: rgba(255, 255, 255, 0.12);
  --mt-accent-indigo: #4f46e5;
  --mt-accent-indigo-hover: #4338ca;
  --mt-accent-purple: #6d28d9;
  --mt-accent-purple-hover: #a78bfa;
  --mt-btn-gradient: linear-gradient(135deg, #6d28d9, #4f46e5);
  --mt-btn-gradient-hover: linear-gradient(135deg, #5b21b6, #4338ca);
  --mt-text-primary: #f8fafc;
  /* [M-A2] Contraste corrigé : #b0bec5 atteint ≥4.5:1 sur fond ardoise */
  --mt-text-secondary: #b0bec5;
  --mt-success: #34d399;
  --mt-error: #fb7185;
  
  /* Tokens supplémentaires pour éliminer les valeurs hardcodées */
  /* [Mi-D3] Centralisation des valeurs de couleur utilisées dans plusieurs sélecteurs */
  --mt-bg-pill-hover: rgba(30, 41, 59, 0.85);
  --mt-accent-purple-dim: rgba(139, 92, 246, 0.2);
  --mt-divider: rgba(255, 255, 255, 0.08);
  --mt-btn-secondary-bg: rgba(255, 255, 255, 0.06);
  --mt-btn-secondary-border: rgba(255, 255, 255, 0.08);
  --mt-bg-input: rgba(255, 255, 255, 0.06);
  --mt-bg-input-hover: rgba(255, 255, 255, 0.10);
  --mt-bg-input-focus: rgba(15, 23, 42, 0.90);
  --mt-option-bg: #1e293b;
  --mt-option-color: #f8fafc;
  --mt-select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");

  /* Arrondis */
  --mt-radius-sm: 6px;
  --mt-radius-md: 10px;
  --mt-radius-full: 9999px;
  
  /* Transitions */
  --mt-duration: 250ms;
  --mt-ease-out: cubic-bezier(0.16, 1, 0.3, 1); /* Easing haut de gamme */
}

/* [M-D3] Mode clair : variables retournées pour une meilleure intégration avec les thèmes clairs de Thunderbird */
@media (prefers-color-scheme: light) {
  :host {
    --mt-bg-glass: rgba(240, 245, 255, 0.92);
    --mt-bg-pill-hover: rgba(210, 220, 240, 0.95);
    --mt-text-primary: #0f172a;
    --mt-text-secondary: #475569;
    --mt-border-glass: rgba(0, 0, 0, 0.10);
    --mt-divider: rgba(0, 0, 0, 0.08);
    --mt-accent-purple-hover: #4f46e5;
    --mt-success: #047857;
    --mt-error: #be123c;
    --mt-btn-secondary-bg: rgba(0, 0, 0, 0.05);
    --mt-btn-secondary-border: rgba(0, 0, 0, 0.12);
    --mt-bg-input: rgba(255, 255, 255, 0.85);
    --mt-bg-input-hover: #ffffff;
    --mt-bg-input-focus: #ffffff;
    --mt-option-bg: #ffffff;
    --mt-option-color: #0f172a;
    --mt-select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23475569' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }
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

.mt-engine-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--mt-accent-purple-hover);
  border: 1px solid rgba(99, 102, 241, 0.3);
  letter-spacing: 0.2px;
  text-transform: none;
  user-select: none;
  cursor: pointer;
  font-family: inherit;
  transition: all var(--mt-duration) var(--mt-ease-out);
  outline: none;
}

.mt-engine-badge:hover {
  filter: brightness(1.15);
  transform: translateY(-1px);
  border-color: var(--mt-accent-purple-hover);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

.mt-engine-badge:focus-visible {
  outline: 2px solid var(--mt-accent-purple-hover);
  outline-offset: 2px;
}

.mt-engine-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 5px #22c55e;
  flex-shrink: 0;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.mt-engine-dot.is-warning {
  background: #f59e0b;
  box-shadow: 0 0 6px #f59e0b;
  animation: mtPulseWarning 1.2s infinite alternate ease-in-out;
}

@keyframes mtPulseWarning {
  from { opacity: 0.6; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1.25); }
}

.mt-engine-gear {
  font-size: 9px;
  opacity: 0.7;
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
  /* [Mi-D3] Remplacement de la valeur hardcodée par le token */
  background: var(--mt-divider);
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
  background-color: var(--mt-bg-input);
  background-image: var(--mt-select-arrow);
  background-repeat: no-repeat;
  background-position: right 10px center;
  border: 1px solid var(--mt-divider);
  border-radius: var(--mt-radius-sm);
  color: var(--mt-text-primary);
  padding: 6px 28px 6px 10px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  /* [B-A1] Suppression de outline:none brut — géré uniquement par :focus-visible ci-dessous */
  outline: 0;
  /* [Mi-D1] Propriétés ciblées au lieu de "all" */
  transition: border-color var(--mt-duration) var(--mt-ease-out),
              background-color var(--mt-duration) var(--mt-ease-out),
              box-shadow var(--mt-duration) var(--mt-ease-out);
  /* [M-D2] min-width réduit + max-width pour les panneaux étroits */
  min-width: 80px;
  max-width: 130px;
}

.mt-select:hover {
  border-color: rgba(139, 92, 246, 0.4);
  background-color: var(--mt-bg-input-hover);
}

.mt-select:focus {
  border-color: var(--mt-accent-purple-hover);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
  background-color: var(--mt-bg-input-focus);
  color: var(--mt-text-primary);
}

.mt-select option {
  background-color: var(--mt-option-bg);
  color: var(--mt-option-color);
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
  /* [Mi-D1] Propriétés ciblées au lieu de "all" */
  transition: background-color var(--mt-duration) var(--mt-ease-out),
              color var(--mt-duration) var(--mt-ease-out),
              border-color var(--mt-duration) var(--mt-ease-out),
              box-shadow var(--mt-duration) var(--mt-ease-out),
              transform var(--mt-duration) var(--mt-ease-out);
  /* [B-A1] outline:0 ici — le focus visible est géré exclusivement par :focus-visible */
  outline: 0;
  white-space: nowrap;
}

.mt-btn-translate {
  background: var(--mt-btn-gradient);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.mt-btn-translate:hover:not(:disabled) {
  background: var(--mt-btn-gradient-hover);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
  transform: translateY(-1px);
}

.mt-btn-translate:active {
  transform: translateY(0) scale(0.97);
}

.mt-btn-original {
  background: var(--mt-btn-secondary-bg);
  color: var(--mt-text-primary);
  border: 1px solid var(--mt-btn-secondary-border);
}

.mt-btn-original:hover {
  filter: brightness(1.15);
  border-color: var(--mt-border-glass);
}

.mt-btn-original:active {
  transform: scale(0.97);
}

/* Bouton Replier */
.mt-btn-collapse {
  background: var(--mt-btn-secondary-bg);
  border: 1px solid var(--mt-btn-secondary-border) !important;
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
  cursor: pointer;
  transition: background-color var(--mt-duration) var(--mt-ease-out),
              color var(--mt-duration) var(--mt-ease-out),
              border-color var(--mt-duration) var(--mt-ease-out),
              transform var(--mt-duration) var(--mt-ease-out);
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

/* [B-A1] Focus visible : indicateur explicité pour TOUS les éléments interactifs. */
.mt-btn:focus-visible,
.mt-engine-badge:focus-visible,
.mt-logo-icon:focus-visible,
.mt-select:focus-visible,
.mt-consent-checkbox:focus-visible {
  outline: 2px solid var(--mt-accent-purple-hover);
  outline-offset: 2px;
}

/* Neutralise le focus ring natif en mode pointeur (clic souris) sans masquer le clavier */
.mt-btn:focus:not(:focus-visible),
.mt-select:focus:not(:focus-visible) {
  outline: 0;
  box-shadow: none;
}

/* Statut de chargement (maintenu dans l'arbre ARIA via .is-empty pour garantir la première annonce) */
.mt-status {
  font-size: 11px;
  color: var(--mt-text-secondary);
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

.mt-status.is-empty {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.mt-status.error   { color: var(--mt-error); }
.mt-status.success { color: var(--mt-success); }

.mt-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--mt-accent-purple-dim);
  border-top-color: var(--mt-accent-purple-hover);
  border-radius: 50%;
  animation: mt-spin 0.6s linear infinite;
  vertical-align: middle;
  margin-right: 6px;
}

@keyframes mt-spin { to { transform: rotate(360deg); } }

/* [M-D2] Responsive : en fenêtre très étroite, les contrôles passent en colonne */
@media (max-width: 480px) {
  .mt-separator {
    display: none;
  }
  .mt-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .mt-select {
    min-width: 100%;
    max-width: unset;
  }
  .mt-status {
    max-width: unset;
    flex: 1 1 100%;
  }
}

/* [M-D1] Réduction de mouvement : désactive les animations pour prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .mt-banner  { animation: none; opacity: 1; }
  .mt-spinner { animation: none; border-style: dashed; border-top-color: var(--mt-accent-purple-hover); }
  .mt-engine-dot.is-warning { animation: none; }
  .mt-engine-badge, .mt-btn, .mt-logo-icon, .mt-select {
    transition: none;
  }
}

.mt-hidden { display: none !important; }

/* ── BARRE DE CONSENTEMENT INLINE (Filet de sécurité Opt-In) ── */
.mt-consent-bar {
  flex: 1 1 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  margin-top: 2px;
  border-radius: var(--mt-radius-sm);
  background: rgba(109, 40, 217, 0.14);
  border: 1px solid rgba(139, 92, 246, 0.4);
  font-size: 12px;
  color: var(--mt-text-primary);
}

.mt-consent-text {
  flex: 1 1 240px;
  line-height: 1.35;
}

.mt-consent-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mt-consent-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--mt-text-primary);
  cursor: pointer;
  user-select: none;
}

.mt-consent-checkbox {
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
  accent-color: #6d28d9;
}

.mt-btn-consent-accept {
  background: var(--mt-btn-gradient);
  color: #ffffff;
  padding: 5px 12px;
  font-size: 11.5px;
}

.mt-btn-consent-accept:hover:not(:disabled) {
  background: var(--mt-btn-gradient-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
}

.mt-btn-consent-accept:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.mt-btn-consent-options {
  background: var(--mt-btn-secondary-bg);
  color: var(--mt-text-primary);
  border: 1px solid var(--mt-btn-secondary-border);
  padding: 5px 10px;
  font-size: 11.5px;
}

.mt-btn-consent-options:hover:not(:disabled) {
  background: var(--mt-bg-input-hover);
  border-color: rgba(139, 92, 246, 0.45);
}

.mt-btn-consent-options:active:not(:disabled) {
  transform: scale(0.98);
}
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
      return {
        text: reponse.text,
        detectedLang: reponse.detectedLang || null,
        providerLabel: reponse.providerLabel || null,
        providerNom: reponse.providerNom || null,
        usedFallback: Boolean(reponse.usedFallback)
      };
    }
    // [Mi-R3] Si sendMessage retourne undefined (listener background sans return Promise)
    // ou une réponse d'échec, on lance une erreur avec un code structuré.
    throw new Error((reponse && reponse.error) || "SERVICE_UNAVAILABLE");
  };

  // ── Codes d'erreur (background) → clés i18n pour un message clair ───────
  // Tout code inconnu retombe sur errorGeneric (affiche le message brut).
  const ERREURS_CONNUES = {
    RATE_LIMITED:        "errorRateLimited",
    SERVICE_UNAVAILABLE: "errorServiceUnavailable",
    TIMEOUT:             "errorTimeout",
    NETWORK:             "errorNetwork",
    PERMISSION_REQUIRED: "errorPermissionRequired",
    CONSENT_REQUIRED:    "errorConsentRequired",
    CLEARTEXT_FORBIDDEN: "errorCleartextForbidden",
    UNAUTHORIZED:        "errorUnauthorized",
    INVALID_PAYLOAD:     "errorServiceUnavailable"
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
    "EMBED", "SVG", "MATH", "CODE", "TEXTAREA", "TEMPLATE"
  ]);

  /**
   * Vérifie si un élément ou l'un de ses ancêtres (jusqu'à `racine`) est ignoré ou masqué.
   * @param {Element|null} parent
   * @param {Element} racine
   * @param {boolean} [exclureCitations=false]
   * @returns {boolean}
   */
  const aAncetreIgnoreOuMasque = (parent, racine, exclureCitations = false) => {
    let el = parent;
    while (el && el !== racine) {
      const nomBalise = (el.tagName || "").toUpperCase();
      if (BALISES_IGNOREES.has(nomBalise)) {
        return true;
      }
      if (el.hidden) {
        return true;
      }
      if (el.style && typeof el.style.display === "string" && el.style.display.toLowerCase() === "none") {
        return true;
      }
      if (exclureCitations) {
        const classe = el.className || "";
        if (
          nomBalise === "BLOCKQUOTE" ||
          (typeof classe === "string" && (classe.includes("moz-cite-prefix") || classe.includes("gmail_quote")))
        ) {
          return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  };

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
        if (!noeud.textContent.trim()) return NodeFilter.FILTER_REJECT;
        if (!noeud.parentElement || aAncetreIgnoreOuMasque(noeud.parentElement, racine, false)) {
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

  /**
   * Extrait un échantillon de texte propre (sans balises techniques ni citations de threads)
   * pour la détection de langue par CLD2.
   *
   * @param   {Element} racine
   * @returns {string}
   */
  const extraireTextePourDetection = (racine) => {
    if (!racine) return "";
    const extraits = [];
    const walker = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
      acceptNode: (noeud) => {
        if (!noeud.textContent.trim()) return NodeFilter.FILTER_REJECT;
        if (!noeud.parentElement || aAncetreIgnoreOuMasque(noeud.parentElement, racine, true)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      extraits.push(walker.currentNode.textContent);
      // Échantillon suffisant pour CLD2 : inutile de parcourir tout un message géant
      if (extraits.length >= 60) break;
    }

    // Jointure par saut de ligne pour permettre le filtrage ligne-par-ligne des citations '>' et amorces
    const texteBrut = extraits.join("\n");
    const nettoyer = (globalThis.MTText && globalThis.MTText.nettoyerTextePourDetection)
      ? globalThis.MTText.nettoyerTextePourDetection
      : (txt) => txt.replace(/\s+/g, " ").trim();
    return nettoyer(texteBrut);
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
    // [Mi-A1] Attribut lang : les lecteurs d'écran utilisent la langue du conteneur
    // pour prononcer correctement l'UI, même si l'e-mail est dans une autre langue.
    conteneur.setAttribute("lang", LOCALE);

    // ── Shadow DOM (isolation CSS) ──────────────────────────────────────
    const shadow = conteneur.attachShadow({ mode: "open" });

    const baliseStyle = document.createElement("style");
    baliseStyle.textContent = CSS_BANDEAU;
    shadow.appendChild(baliseStyle);

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
    // [M-A1] logoIcone purement décoratif : on retire le rôle bouton (doublon avec btnReplier).
    // L'utilisateur clavier n'a pas besoin de deux contrôles identiques dans le flux de tabulation.
    logoIcone.setAttribute("aria-hidden", "true");
    logoIcone.title = t("tooltipCollapse");
    logo.appendChild(logoIcone);

    // Badge moteur actif interactif
    const badgeMoteur = document.createElement("button");
    badgeMoteur.type = "button";
    badgeMoteur.className = "mt-engine-badge";
    badgeMoteur.title = t("badgeActiveTitle", { provider: "Google Translate" });
    badgeMoteur.setAttribute("aria-label", t("badgeActiveAria", { provider: "Google Translate" }));

    const badgeDot = document.createElement("span");
    badgeDot.className = "mt-engine-dot";
    badgeDot.setAttribute("aria-hidden", "true");
    badgeMoteur.appendChild(badgeDot);

    const badgeMoteurLabel = document.createElement("span");
    badgeMoteurLabel.className = "mt-engine-label";
    badgeMoteurLabel.textContent = "Google";
    badgeMoteur.appendChild(badgeMoteurLabel);

    const badgeGear = document.createElement("span");
    badgeGear.className = "mt-engine-gear";
    badgeGear.textContent = "⚙️";
    badgeGear.setAttribute("aria-hidden", "true");
    badgeMoteur.appendChild(badgeGear);

    logo.appendChild(badgeMoteur);
    bandeau.appendChild(logo);

    // Séparateur vertical
    const sep = document.createElement("div");
    sep.className = "mt-separator";
    bandeau.appendChild(sep);

    // Zone de contrôles
    const controles = document.createElement("div");
    controles.className = "mt-controls";

    // ── Sélecteur source ────────────────────────────────────────────
    const selectSource = document.createElement("select");
    selectSource.className = "mt-select";
    selectSource.id = "mt-select-source";
    selectSource.setAttribute("aria-label", t("ariaSelectSource"));
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
    const selectCible = document.createElement("select");
    selectCible.className = "mt-select";
    selectCible.id = "mt-select-cible";
    selectCible.setAttribute("aria-label", t("ariaSelectTarget"));
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
    btnTraduire.type = "button";
    btnTraduire.className = "mt-btn mt-btn-translate";
    btnTraduire.textContent = t("btnTranslate");
    controles.appendChild(btnTraduire);

    // ── Bouton « Original » (masqué par défaut) ─────────────────────
    const btnOriginal = document.createElement("button");
    btnOriginal.type = "button";
    btnOriginal.className = "mt-btn mt-btn-original mt-hidden";
    btnOriginal.textContent = t("btnOriginal");
    controles.appendChild(btnOriginal);

    bandeau.appendChild(controles);

    // ── Zone de statut (toujours présente dans l'arbre ARIA via .is-empty) ──
    const statut = document.createElement("span");
    statut.className = "mt-status is-empty";
    statut.setAttribute("role", "status");
    statut.setAttribute("aria-live", "polite");
    statut.setAttribute("aria-atomic", "true");
    bandeau.appendChild(statut);

    // ── Bouton « Replier » ──────────────────────────────────────────
    const btnReplier = document.createElement("button");
    btnReplier.type = "button";
    btnReplier.className = "mt-btn mt-btn-collapse";
    btnReplier.textContent = "▴";
    btnReplier.title = t("tooltipCollapse");
    btnReplier.setAttribute("aria-label", t("tooltipCollapse"));
    bandeau.appendChild(btnReplier);

    // ── Barre de consentement inline (filet de sécurité Opt-In) ─────
    const consentBar = document.createElement("div");
    consentBar.className = "mt-consent-bar mt-hidden";
    consentBar.setAttribute("role", "region");
    consentBar.setAttribute("aria-label", t("ariaConsentRegion"));

    const consentText = document.createElement("span");
    consentText.className = "mt-consent-text";
    consentText.textContent = t("consentPrompt");
    consentBar.appendChild(consentText);

    const consentActions = document.createElement("div");
    consentActions.className = "mt-consent-actions";

    const lblConsentMyMemory = document.createElement("label");
    lblConsentMyMemory.className = "mt-consent-checkbox-label";
    const chkConsentMyMemory = document.createElement("input");
    chkConsentMyMemory.type = "checkbox";
    chkConsentMyMemory.className = "mt-consent-checkbox";
    chkConsentMyMemory.checked = true;
    const spanConsentMyMemory = document.createElement("span");
    spanConsentMyMemory.textContent = t("consentFallbackCheckbox");
    lblConsentMyMemory.appendChild(chkConsentMyMemory);
    lblConsentMyMemory.appendChild(spanConsentMyMemory);
    consentActions.appendChild(lblConsentMyMemory);

    const btnConsentAccept = document.createElement("button");
    btnConsentAccept.type = "button";
    btnConsentAccept.className = "mt-btn mt-btn-consent-accept";
    btnConsentAccept.textContent = t("btnConsentAccept");
    consentActions.appendChild(btnConsentAccept);

    const btnConsentOptions = document.createElement("button");
    btnConsentOptions.type = "button";
    btnConsentOptions.className = "mt-btn mt-btn-consent-options";
    btnConsentOptions.textContent = t("btnConsentOptions");
    consentActions.appendChild(btnConsentOptions);

    consentBar.appendChild(consentActions);
    bandeau.appendChild(consentBar);

    shadow.appendChild(bandeau);

    // ── Objet de retour (références directes aux éléments du DOM) ────
    return {
      conteneur,
      shadow,
      bandeau,
      logoIcone,
      badgeMoteur,
      badgeDot,
      badgeMoteurLabel,
      selectSource,
      selectCible,
      btnTraduire,
      btnOriginal,
      statut,
      btnReplier,
      consentBar,
      consentText,
      chkConsentMyMemory,
      spanConsentMyMemory,
      btnConsentAccept,
      btnConsentOptions
    };
  };

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALISATION (ÉTAT ISOLÉ PAR INSTANCE)
  // ═══════════════════════════════════════════════════════════════════════

  async function initialiser() {
    // ── Nettoyage de l'instance précédente ───────────────────────────────
    nettoyerInstance();

    document.documentElement._mtSeq = (document.documentElement._mtSeq || 0) + 1;
    const instanceId = document.documentElement._mtSeq;
    document.documentElement._mtActiveInstanceId = instanceId;

    /** Map<Text, string> — Sauvegarde des contenus originaux (null si non traduit) */
    let contenusOriginaux = null;
    /** Indique si le bandeau est actuellement déplié */
    let estDeplie = false;
    /** Indique si l'utilisateur a modifié manuellement la langue cible */
    let cibleModifieeParUtilisateur = false;
    /** Indique si getConfig a répondu au moins une fois */
    let configChargee = false;

    const timersActifs = new Set();
    const planifierTimer = (fn, delai) => {
      const id = setTimeout(() => {
        timersActifs.delete(id);
        fn();
      }, delai);
      timersActifs.add(id);
      return id;
    };

    LOCALE = detecterLocale();

    const ui = construireUI();

    let aPermissionMoteur = true;
    let estMoteurConfigure = true;
    let consentementRequis = false;
    let origineRequise = "";
    let autoTraduire1Clic = false;
    let autoTranslateOnOpen = false;
    let autoTranslateMode = "all_foreign";
    let autoTranslateLangs = [];
    let langueAlternance = "none";
    let cibleAvantAlternance = null;
    let sourceAvantAlternance = null;
    let traductionEnCours = false;

    const synchroniserEtatBoutonTraduire = () => {
      if (traductionEnCours) return;
      if (consentementRequis) {
        ui.btnTraduire.disabled = true;
        ui.btnTraduire.setAttribute("aria-disabled", "true");
      } else {
        ui.btnTraduire.disabled = false;
        ui.btnTraduire.removeAttribute("aria-disabled");
      }
    };

    ui.selectCible.addEventListener("change", () => {
      cibleModifieeParUtilisateur = true;
    });

    const languesSontEquivalentes = (l1, l2) => {
      if (!l1 || !l2) return false;
      const n1 = l1.toLowerCase();
      const n2 = l2.toLowerCase();
      if (n1 === n2) return true;
      return n1.split("-")[0] === n2.split("-")[0];
    };

    const ouvrirOptions = () => {
      try {
        browser.runtime.openOptionsPage();
      } catch {
        browser.runtime.sendMessage({ action: "openOptions" }).catch(() => {});
      }
    };

    ui.badgeMoteur.addEventListener("click", ouvrirOptions);
    ui.btnConsentOptions.addEventListener("click", ouvrirOptions);

    // ── Insertion dans le DOM ────────────────────────────────────────────
    ui.bandeau.classList.add("mt-hidden");

    if (document.body) {
      document.body.insertBefore(ui.conteneur, document.body.firstChild);
    } else {
      document.documentElement.insertBefore(ui.conteneur, document.documentElement.firstChild);
    }

    // ── Déplier / replier ────────────────────────────────────────────────
    const deplier = ({ focus = true } = {}) => {
      estDeplie = true;
      ui.bandeau.classList.remove("mt-hidden");
      if (focus) {
        if (consentementRequis && ui.btnConsentAccept) {
          ui.btnConsentAccept.focus();
        } else {
          ui.selectSource.focus();
        }
      }
    };

    const replier = ({ restaurerFocus = false } = {}) => {
      estDeplie = false;
      ui.bandeau.classList.add("mt-hidden");
      if (restaurerFocus && document.body) {
        try {
          const avaitTabindex = document.body.hasAttribute("tabindex");
          if (!avaitTabindex) {
            document.body.setAttribute("tabindex", "-1");
          }
          document.body.focus({ preventScroll: true });
          if (!avaitTabindex) {
            document.body.removeAttribute("tabindex");
          }
        } catch { /* ignorer */ }
      }
    };

    ui.logoIcone.addEventListener("click", () => {
      replier({ restaurerFocus: true });
    });

    ui.btnReplier.addEventListener("click", () => {
      replier({ restaurerFocus: true });
    });

    ui.bandeau.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        replier({ restaurerFocus: true });
      }
    });

    // ── Synchronisation réactive de la configuration avec le background ──
    const actualiserConfig = async () => {
      try {
        const res = await browser.runtime.sendMessage({ action: "getConfig" });
        if (!res || !res.success || document.documentElement._mtActiveInstanceId !== instanceId) {
          return false;
        }
        configChargee = true;

        if (res.uiLanguage) {
          const langUi = res.uiLanguage.split("-")[0].toLowerCase();
          if (I18N[langUi] && LOCALE !== langUi) {
            LOCALE = langUi;
            ui.conteneur.setAttribute("lang", LOCALE);
            ui.bandeau.setAttribute("aria-label", t("bannerTitle"));
            ui.logoIcone.title = t("tooltipCollapse");
            ui.selectSource.setAttribute("aria-label", t("ariaSelectSource"));
            ui.selectCible.setAttribute("aria-label", t("ariaSelectTarget"));
            ui.btnTraduire.textContent = contenusOriginaux ? t("btnRetranslate") : t("btnTranslate");
            ui.btnOriginal.textContent = t("btnOriginal");
            ui.btnReplier.title = t("tooltipCollapse");
            ui.btnReplier.setAttribute("aria-label", t("tooltipCollapse"));
            ui.consentBar.setAttribute("aria-label", t("ariaConsentRegion"));
            ui.consentText.textContent = t("consentPrompt");
            ui.spanConsentMyMemory.textContent = t("consentFallbackCheckbox");
            ui.btnConsentAccept.textContent = t("btnConsentAccept");
            ui.btnConsentOptions.textContent = t("btnConsentOptions");
            const optAuto = ui.selectSource.querySelector('option[value="auto"]');
            if (optAuto) optAuto.textContent = t("autoDetect");
          }
          if (!cibleModifieeParUtilisateur && !contenusOriginaux) {
            let langueCibleTrouvee = null;
            if (LANGUES.some((l) => l.code === res.uiLanguage)) {
              langueCibleTrouvee = res.uiLanguage;
            } else if (LANGUES.some((l) => l.code === langUi)) {
              langueCibleTrouvee = langUi;
            }
            if (langueCibleTrouvee) {
              ui.selectCible.value = langueCibleTrouvee;
            }
          }
        }

        if (res.alternateTarget) {
          langueAlternance = res.alternateTarget;
        }
        if (res.autoTranslateOnClick !== undefined) {
          autoTraduire1Clic = Boolean(res.autoTranslateOnClick);
        }
        if (res.autoTranslateOnOpen !== undefined) {
          autoTranslateOnOpen = Boolean(res.autoTranslateOnOpen);
          autoTranslateMode = res.autoTranslateMode || "all_foreign";
          autoTranslateLangs = Array.isArray(res.autoTranslateLangs) ? res.autoTranslateLangs : [];
        }

        if (res.consentRequired || res.provider === "none") {
          consentementRequis = true;
          estMoteurConfigure = false;
          ui.consentBar.classList.remove("mt-hidden");
          ui.badgeDot.classList.add("is-warning");
          ui.badgeMoteurLabel.textContent = t("badgeUnconfigured");
          ui.badgeMoteur.title = t("errorConsentRequired");
          ui.badgeMoteur.setAttribute("aria-label", t("errorConsentRequired"));
        } else {
          consentementRequis = false;
          estMoteurConfigure = res.isConfigured !== false;
          ui.consentBar.classList.add("mt-hidden");
          const nomLabel = res.providerLabel || "Google";
          const nomComplet = res.providerNom || nomLabel;
          ui.badgeMoteurLabel.textContent = nomLabel;

          if (res.hasPermission === false) {
            aPermissionMoteur = false;
            origineRequise = res.requiredOrigin || "";
            ui.badgeDot.classList.add("is-warning");
            ui.badgeMoteur.title = t("badgePermWarningTitle", { provider: nomComplet });
            ui.badgeMoteur.setAttribute("aria-label", t("badgePermWarningAria", { provider: nomComplet }));
          } else if (!estMoteurConfigure) {
            aPermissionMoteur = true;
            origineRequise = "";
            ui.badgeDot.classList.add("is-warning");
            ui.badgeMoteur.title = t("badgeKeyWarningTitle", { provider: nomComplet });
            ui.badgeMoteur.setAttribute("aria-label", t("badgeKeyWarningAria", { provider: nomComplet }));
          } else {
            aPermissionMoteur = true;
            origineRequise = "";
            ui.badgeDot.classList.remove("is-warning");
            ui.badgeMoteur.title = t("badgeActiveTitle", { provider: nomComplet });
            ui.badgeMoteur.setAttribute("aria-label", t("badgeActiveAria", { provider: nomComplet }));
          }
        }

        synchroniserEtatBoutonTraduire();
        return true;
      } catch {
        return false;
      }
    };

    const lancerTraduction = async (options = {}) => {
      if (traductionEnCours) return;
      const replierApres = Boolean(options && options.replierApres);
      const isAutoOnOpen = Boolean(options && options.isAutoOnOpen);

      // Re-synchronisation de l'état si nécessaire (ex. retour depuis setup.html ou options.html)
      if (!configChargee || consentementRequis || !aPermissionMoteur || !estMoteurConfigure) {
        await actualiserConfig();
        if (document.documentElement._mtActiveInstanceId !== instanceId) return;
      }

      if (!estDeplie && !replierApres) deplier({ focus: !isAutoOnOpen });

      if (!document.body) {
        afficherStatut(ui.statut, t("errorNoText"), "error");
        return;
      }

      // Garde-fou Opt-In ATN : afficher la barre de consentement si aucun moteur n'est configuré
      if (consentementRequis) {
        ui.consentBar.classList.remove("mt-hidden");
        afficherStatut(ui.statut, t("errorConsentRequired"), "error");
        if (!isAutoOnOpen && ui.btnConsentAccept) {
          ui.btnConsentAccept.focus();
        }
        return;
      }

      // Signalement explicite si la permission réseau manque
      if (!aPermissionMoteur && origineRequise) {
        const nomMoteur = (ui.badgeMoteurLabel && ui.badgeMoteurLabel.textContent) || "le moteur actif";
        afficherStatut(ui.statut, t("errorPermissionRequired", { provider: nomMoteur }), "error");
        return;
      }

      // Signalement explicite si la clé d'API manque
      if (!estMoteurConfigure) {
        afficherStatut(ui.statut, t("errorUnauthorized"), "error");
        return;
      }

      let source = ui.selectSource.value;
      let cible  = ui.selectCible.value;
      let utiliseAlternance = false;
      let traductionsAppliquees = false;

      // ── Validation & Alternance directe si source explicite == cible ──────
      if (!isAutoOnOpen && languesSontEquivalentes(source, cible)) {
        if (langueAlternance && langueAlternance !== "none" && !languesSontEquivalentes(langueAlternance, source)) {
          if (!cibleAvantAlternance) cibleAvantAlternance = ui.selectCible.value;
          cible = langueAlternance;
          utiliseAlternance = true;
          ui.selectCible.value = cible;
        } else {
          afficherStatut(ui.statut, t("errorSameLanguage"), "error");
          return;
        }
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
      traductionEnCours = true;
      ui.btnTraduire.disabled  = true;
      ui.btnOriginal.disabled  = true;
      ui.btnTraduire.setAttribute("aria-busy", "true");
      ui.btnTraduire.setAttribute("aria-disabled", "true");
      ui.selectSource.disabled = true;
      ui.selectCible.disabled  = true;
      afficherStatut(ui.statut, t("statusTranslating"), "loading");

      let derniereLangDetectee = null;

      try {
        // ── Séparateur unique anti-collision ─────────────────────────────
        const textContentTotal = document.body.textContent || "";
        const hex4 = () => {
          const buf = new Uint16Array(1);
          crypto.getRandomValues(buf);
          return buf[0].toString(16).padStart(4, "0");
        };
        let SENTINEL;
        do {
          SENTINEL = "MTSEP" + hex4() + hex4() + hex4() + hex4() + hex4() + hex4();
        } while (textContentTotal.toUpperCase().includes(SENTINEL.toUpperCase()));
        const SEPARATEUR = "\n" + SENTINEL + "\n";
        const SEPARATEUR_RE = new RegExp("\\s*" + SENTINEL + "\\s*", "gi");

        // ── Découpage en lots (chunks) ──────────────────────────────────
        const TAILLE_MAX_LOT = 4000;
        const lots = [];
        let lotCourant = { noeuds: [], texte: "" };

        noeudsTexte.forEach((noeud) => {
          let txt = contenusOriginaux.get(noeud);
          if (txt === undefined) {
            txt = noeud.textContent || "";
            contenusOriginaux.set(noeud, txt);
          }
          const { lead, coeur, trail } = extraireEspaces(txt);
          const tailSep = lotCourant.texte ? SEPARATEUR.length : 0;

          if (lotCourant.texte.length + tailSep + coeur.length > TAILLE_MAX_LOT &&
              lotCourant.noeuds.length > 0) {
            lots.push(lotCourant);
            lotCourant = { noeuds: [], texte: "" };
          }

          lotCourant.noeuds.push({ noeud, lead, trail });
          lotCourant.texte += (lotCourant.texte ? SEPARATEUR : "") + coeur;
        });

        if (lotCourant.noeuds.length > 0) {
          lots.push(lotCourant);
        }

        // ── Traduction lot par lot ──────────────────────────────────────
        const traductions = new Map();
        let echecsNoeuds = 0;
        let derniereErreurNoeud = null;

        for (let i = 0; i < lots.length; i++) {
          const lot = lots[i];

          if (document.documentElement._mtActiveInstanceId !== instanceId) break;

          if (lots.length > 1) {
            afficherStatut(ui.statut, t("statusTranslatingChunk", { i: i + 1, n: lots.length }), "loading");
          }

          // ── Nœud unique très long (> limite) : sous-découpage ───────────
          if (lot.noeuds.length === 1 && lot.texte.length > TAILLE_MAX_LOT) {
            const entree = lot.noeuds[0];
            const morceaux = [];
            const segments = decouperLong(lot.texte, TAILLE_MAX_LOT);
            for (let sIdx = 0; sIdx < segments.length; sIdx++) {
              const seg = segments[sIdx];
              if (document.documentElement._mtActiveInstanceId !== instanceId) break;
              let r = await demanderTraduction(seg, source, cible);
              if (r.detectedLang) derniereLangDetectee = r.detectedLang;

              // Détection d'inversion ou d'alternance sur le premier segment du premier lot (mode manuel uniquement)
              if (!isAutoOnOpen && i === 0 && sIdx === 0 && derniereLangDetectee && languesSontEquivalentes(derniereLangDetectee, cible)) {
                if (source !== "auto" && !languesSontEquivalentes(source, cible)) {
                  if (!cibleAvantAlternance) cibleAvantAlternance = ui.selectCible.value;
                  if (!sourceAvantAlternance) sourceAvantAlternance = ui.selectSource.value;
                  cible = source;
                  source = derniereLangDetectee;
                  utiliseAlternance = true;
                  ui.selectCible.value = cible;
                  ui.selectSource.value = source;
                  r = await demanderTraduction(seg, source, cible);
                  if (r.detectedLang) derniereLangDetectee = r.detectedLang;
                } else if (langueAlternance && langueAlternance !== "none" && !languesSontEquivalentes(langueAlternance, derniereLangDetectee)) {
                  if (!cibleAvantAlternance) cibleAvantAlternance = ui.selectCible.value;
                  cible = langueAlternance;
                  source = derniereLangDetectee;
                  utiliseAlternance = true;
                  ui.selectCible.value = cible;
                  r = await demanderTraduction(seg, source, cible);
                  if (r.detectedLang) derniereLangDetectee = r.detectedLang;
                }
              }
              morceaux.push(r.text);
            }
            traductions.set(entree.noeud, entree.lead + morceaux.join("") + entree.trail);
            continue;
          }

          let resultat = await demanderTraduction(lot.texte, source, cible);

          if (resultat.detectedLang) {
            derniereLangDetectee = resultat.detectedLang;
          }

          // Inversion de sens ou bascule d'alternance si le texte est déjà dans la langue cible (mode manuel uniquement)
          if (!isAutoOnOpen && i === 0 && derniereLangDetectee && languesSontEquivalentes(derniereLangDetectee, cible)) {
            if (source !== "auto" && !languesSontEquivalentes(source, cible)) {
              if (!cibleAvantAlternance) cibleAvantAlternance = ui.selectCible.value;
              if (!sourceAvantAlternance) sourceAvantAlternance = ui.selectSource.value;
              cible = source;
              source = derniereLangDetectee;
              utiliseAlternance = true;
              ui.selectCible.value = cible;
              ui.selectSource.value = source;
              resultat = await demanderTraduction(lot.texte, source, cible);
              if (resultat.detectedLang) derniereLangDetectee = resultat.detectedLang;
            } else if (langueAlternance && langueAlternance !== "none" && !languesSontEquivalentes(langueAlternance, derniereLangDetectee)) {
              if (!cibleAvantAlternance) cibleAvantAlternance = ui.selectCible.value;
              cible = langueAlternance;
              source = derniereLangDetectee;
              utiliseAlternance = true;
              ui.selectCible.value = cible;
              resultat = await demanderTraduction(lot.texte, source, cible);
              if (resultat.detectedLang) derniereLangDetectee = resultat.detectedLang;
            }
          }
          if (resultat.providerLabel && ui.badgeMoteur) {
            const suffixeSecours = resultat.usedFallback ? t("badgeFallbackSuffix") : "";
            const labelAffiche = resultat.providerLabel + suffixeSecours;
            const nomAffiche = (resultat.providerNom || resultat.providerLabel) + suffixeSecours;
            ui.badgeMoteurLabel.textContent = labelAffiche;
            ui.badgeMoteur.title = t("badgeActiveTitle", { provider: nomAffiche });
            ui.badgeMoteur.setAttribute("aria-label", t("badgeActiveAria", { provider: nomAffiche }));
          }

          if (lot.noeuds.length === 1) {
            const entree = lot.noeuds[0];
            const coeurTraduit = resultat.text.replace(SEPARATEUR_RE, "").trim();
            traductions.set(entree.noeud, entree.lead + coeurTraduit + entree.trail);
          } else {
            const parties = resultat.text.split(SEPARATEUR_RE);
            if (parties.length !== lot.noeuds.length) {
              console.warn("[MagicTranslator] Separator mismatch, falling back to node-by-node translation for this chunk", parties.length, lot.noeuds.length);
              for (const entree of lot.noeuds) {
                if (!contenusOriginaux || document.documentElement._mtActiveInstanceId !== instanceId) break;
                try {
                  const origTxt = contenusOriginaux.get(entree.noeud) || "";
                  const res = await demanderTraduction(origTxt.trim(), source, cible);
                  traductions.set(entree.noeud, entree.lead + res.text.trim() + entree.trail);
                } catch (e) {
                  echecsNoeuds++;
                  derniereErreurNoeud = e;
                  console.error("[MagicTranslator] Fallback translation failed for node", e);
                  if (e.message === "RATE_LIMITED" || e.message === "NETWORK" || e.message === "UNAUTHORIZED" || e.message === "CONSENT_REQUIRED") {
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

        if (document.documentElement._mtActiveInstanceId !== instanceId) {
          return;
        }

        if (traductions.size === 0 && echecsNoeuds > 0) {
          throw derniereErreurNoeud || new Error("SERVICE_UNAVAILABLE");
        }

        // ── Écriture atomique dans le DOM (tous les lots ont abouti) ──────
        traductions.forEach((texte, noeud) => {
          noeud.textContent = texte;
        });
        traductionsAppliquees = true;

        // ── Affichage du statut ──────────────────────────────────────────
        if (echecsNoeuds > 0) {
          afficherStatut(ui.statut, t("statusTranslatedPartial"), "error");
        } else if (utiliseAlternance) {
          const nomLang = NOMS_LANGUES[cible] || cible;
          afficherStatut(ui.statut, "✓ " + t("statusTranslatedAlternate", { lang: nomLang }), "success");
        } else if (ui.selectSource.value === "auto" && derniereLangDetectee && languesSontEquivalentes(derniereLangDetectee, cible)) {
          if (isAutoOnOpen) {
            contenusOriginaux = null;
            replier();
            return;
          }
          const nomLang = NOMS_LANGUES[cible] || cible;
          afficherStatut(ui.statut, "✓ " + t("statusAlreadyIn", { lang: nomLang }), "success");
        } else if (derniereLangDetectee && ui.selectSource.value === "auto") {
          const nomLang = NOMS_LANGUES[derniereLangDetectee] || derniereLangDetectee;
          afficherStatut(ui.statut, "✓ " + t("statusTranslatedFrom", { lang: nomLang }), "success");
        } else {
          afficherStatut(ui.statut, "✓ " + t("statusTranslated"), "success");
        }

        ui.btnOriginal.classList.remove("mt-hidden");
        ui.btnTraduire.textContent = t("btnRetranslate");

        if (replierApres) {
          replier();
        }

      } catch (erreur) {
        console.error("[MagicTranslator] Erreur de traduction :", erreur);
        if (document.documentElement._mtActiveInstanceId !== instanceId) {
          return;
        }
        if (!traductionsAppliquees) {
          contenusOriginaux = null;
        }
        if (erreur && erreur.message === "CONSENT_REQUIRED") {
          consentementRequis = true;
          ui.consentBar.classList.remove("mt-hidden");
          if (!isAutoOnOpen && ui.btnConsentAccept) {
            ui.btnConsentAccept.focus();
          }
        }
        const cle = ERREURS_CONNUES[erreur.message];
        const nomMoteur = (ui.badgeMoteurLabel && ui.badgeMoteurLabel.textContent) || "Google";
        const msg = cle ? t(cle, { provider: nomMoteur }) : t("errorGeneric", { msg: erreur.message });
        afficherStatut(ui.statut, msg, "error");
      } finally {
        // ── Déverrouillage de l'interface ────────────────────────────────
        traductionEnCours = false;
        if (document.documentElement._mtActiveInstanceId === instanceId) {
          ui.btnOriginal.disabled  = false;
          ui.selectSource.disabled = false;
          ui.selectCible.disabled  = false;
          ui.btnTraduire.removeAttribute("aria-busy");
          synchroniserEtatBoutonTraduire();
          if (estDeplie && !isAutoOnOpen && !consentementRequis) {
            ui.btnTraduire.focus();
          }
        }
      }
    };

    // ── Bouton « Traduire » ─────────────────────────────────────────────
    ui.btnTraduire.addEventListener("click", () => {
      lancerTraduction();
    });

    // ── Bouton d'activation 1-clic du filet de sécurité (Opt-In inline) ──
    ui.btnConsentAccept.addEventListener("click", async () => {
      if (ui.btnConsentAccept.disabled) return;
      ui.btnConsentAccept.disabled = true;
      try {
        const autoriserRelais = Boolean(ui.chkConsentMyMemory && ui.chkConsentMyMemory.checked);
        const res = await browser.runtime.sendMessage({
          action: "acceptDefaultProvider",
          enableMyMemoryFallback: autoriserRelais
        });
        if (res && res.success) {
          consentementRequis = false;
          estMoteurConfigure = true;
          aPermissionMoteur = true;
          ui.consentBar.classList.add("mt-hidden");
          ui.badgeDot.classList.remove("is-warning");
          const labelMoteur = res.providerLabel || "Google";
          const nomMoteur = res.providerNom || "Google Translate";
          ui.badgeMoteurLabel.textContent = labelMoteur;
          ui.badgeMoteur.title = t("badgeActiveTitle", { provider: nomMoteur });
          ui.badgeMoteur.setAttribute("aria-label", t("badgeActiveAria", { provider: nomMoteur }));
          synchroniserEtatBoutonTraduire();
          await lancerTraduction();
        } else {
          afficherStatut(ui.statut, t("errorServiceUnavailable"), "error");
        }
      } catch {
        afficherStatut(ui.statut, t("errorServiceUnavailable"), "error");
      } finally {
        ui.btnConsentAccept.disabled = false;
      }
    });

    // ── Bouton « Original » — restauration du texte d'origine ───────────
    ui.btnOriginal.addEventListener("click", () => {
      if (traductionEnCours || !contenusOriginaux) return;

      contenusOriginaux.forEach((texte, noeud) => {
        noeud.textContent = texte;
      });

      if (cibleAvantAlternance) {
        ui.selectCible.value = cibleAvantAlternance;
        cibleAvantAlternance = null;
      }
      if (sourceAvantAlternance) {
        ui.selectSource.value = sourceAvantAlternance;
        sourceAvantAlternance = null;
      }

      contenusOriginaux = null;
      ui.btnOriginal.classList.add("mt-hidden");
      ui.btnTraduire.textContent = t("btnTranslate");
      afficherStatut(ui.statut, "", "");
      ui.btnTraduire.focus();
    });

    // ── Écoute du message "toggleBanner" envoyé par background.js ─────────
    const gererMessageBg = (message) => {
      if (message && message.action === "toggleBanner") {
        if (message.alternateTarget && message.alternateTarget !== "none") {
          langueAlternance = message.alternateTarget;
        }
        if (estDeplie) {
          replier({ restaurerFocus: true });
        } else {
          actualiserConfig().then(() => {
            if (document.documentElement._mtActiveInstanceId !== instanceId) return;
            deplier({ focus: true });
            if ((message.autoTranslate || autoTraduire1Clic) && !contenusOriginaux && !consentementRequis) {
              planifierTimer(() => {
                if (estDeplie && !traductionEnCours && !contenusOriginaux && document.documentElement._mtActiveInstanceId === instanceId) {
                  lancerTraduction();
                }
              }, 60);
            }
          });
        }
      }
    };

    // ── Écoute des changements de configuration en temps réel (storage.onChanged) ──
    const gererChangementStorage = (changements, zone) => {
      if (zone !== "local") return;
      if (
        changements.provider ||
        changements.deeplApiKey ||
        changements.geminiApiKey ||
        changements.llmApiKey ||
        changements.llmPreset ||
        changements.llmBaseUrl ||
        changements.libretranslateUrl ||
        changements.alternateTarget ||
        changements.autoTranslateOnClick ||
        changements.autoTranslateOnOpen
      ) {
        actualiserConfig();
      }
    };

    document.documentElement._mtMessageListener = gererMessageBg;
    browser.runtime.onMessage.addListener(gererMessageBg);
    if (browser.storage && browser.storage.onChanged) {
      document.documentElement._mtStorageListener = gererChangementStorage;
      browser.storage.onChanged.addListener(gererChangementStorage);
    }
    document.documentElement._mtCleanup = () => {
      timersActifs.forEach((id) => clearTimeout(id));
      timersActifs.clear();
    };

    // ── Mode Zéro-Clic (Traduction automatique à l'ouverture) ───────────
    const tenterAutoTraductionZeroClic = (tentative = 0) => {
      if (consentementRequis || !autoTranslateOnOpen || !aPermissionMoteur || !estMoteurConfigure || !document.body || contenusOriginaux) return;
      if (document.documentElement._mtActiveInstanceId !== instanceId) return;

      const texteEchantillon = extraireTextePourDetection(document.body);
      if (texteEchantillon.length < 35) {
        if (tentative < 3) {
          planifierTimer(() => tenterAutoTraductionZeroClic(tentative + 1), 150);
        }
        return;
      }

      browser.runtime.sendMessage({
        action: "detectLanguage",
        text: texteEchantillon.slice(0, 1500)
      }).then((detectRes) => {
        if (document.documentElement._mtActiveInstanceId !== instanceId || contenusOriginaux) return;

        if (detectRes && detectRes.success && detectRes.lang) {
          const cibleActuelle = ui.selectCible.value;
          const estFortementFiable = Boolean(detectRes.isReliable) && (detectRes.percentage >= 80);
          if (!estFortementFiable) return;

          const listeLangues = Array.isArray(detectRes.languages) ? detectRes.languages : [];
          const contientLangueUtilisateur = listeLangues.some(
            (l) => languesSontEquivalentes(l.lang, cibleActuelle) && l.percentage >= 15
          );
          if (contientLangueUtilisateur) return;

          const langDetectee = detectRes.lang;
          if (!languesSontEquivalentes(langDetectee, cibleActuelle)) {
            const doitTraduire = (autoTranslateMode === "selected")
              ? autoTranslateLangs.some((l) => languesSontEquivalentes(l, langDetectee))
              : true;

            if (doitTraduire && document.documentElement._mtActiveInstanceId === instanceId && !contenusOriginaux) {
              lancerTraduction({ isAutoOnOpen: true });
            }
          }
        }
      }).catch(() => {});
    };

    actualiserConfig().then((ok) => {
      if (ok && autoTranslateOnOpen && aPermissionMoteur && estMoteurConfigure && !consentementRequis) {
        tenterAutoTraductionZeroClic();
      }
    });

    // ── MutationObserver — filet de sécurité ─────────────────────────────
    const observeur = new MutationObserver(() => {
      if (!document.body || !document.body.contains(ui.conteneur)) {
        observeur.disconnect();
        initialiser().catch(console.error);
      }
    });
    if (document.body) {
      observeur.observe(document.body, { childList: true });
    }
    observeur.observe(document.documentElement, { childList: true });
    document.documentElement._mtObserver = observeur;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Supprime l'ancienne instance de l'UI, annule ses timers et débranche tous ses écouteurs.
   */
  function nettoyerInstance() {
    document.documentElement._mtCleanup?.();
    document.documentElement._mtCleanup = null;
    document.getElementById("magic-translator-root")?.remove();
    document.documentElement._mtObserver?.disconnect();
    document.documentElement._mtObserver = null;
    if (document.documentElement._mtMessageListener) {
      browser.runtime.onMessage.removeListener(document.documentElement._mtMessageListener);
      document.documentElement._mtMessageListener = null;
    }
    if (document.documentElement._mtStorageListener && browser.storage && browser.storage.onChanged) {
      browser.storage.onChanged.removeListener(document.documentElement._mtStorageListener);
      document.documentElement._mtStorageListener = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AFFICHAGE DU STATUT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Met à jour la zone de statut dans le bandeau tout en la gardant présente dans l'arbre ARIA.
   *
   * @param {HTMLElement} el      — Élément DOM du statut
   * @param {string}      message — Message à afficher (vide = masquer visuellement via .is-empty)
   * @param {string}      type    — "loading" | "error" | "success" | ""
   */
  function afficherStatut(el, message, type) {
    el.classList.remove("error", "success", "mt-hidden");
    el.textContent = "";

    if (!message) {
      el.classList.add("is-empty");
      return;
    }

    el.classList.remove("is-empty");

    if (type === "loading") {
      const spinner = document.createElement("span");
      spinner.className = "mt-spinner";
      spinner.setAttribute("aria-hidden", "true");
      el.appendChild(spinner);
      el.appendChild(document.createTextNode(message));
    } else if (type === "error") {
      const icone = document.createElement("span");
      icone.setAttribute("aria-hidden", "true");
      icone.textContent = "⚠ ";
      el.appendChild(icone);
      el.appendChild(document.createTextNode(message));
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
