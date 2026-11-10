# Politique de Confidentialité / Privacy Policy — Magic Translator

**Dernière mise à jour / Last updated** : 8 novembre 2026

---

## 🇫🇷 Français

### 1. Préambule et Engagements
L'extension **Magic Translator** pour Mozilla Thunderbird est développée par **MTF Karukera** dans le respect strict de la vie privée des utilisateurs, du Règlement Général sur la Protection des Données (RGPD) et des politiques de sécurité de Mozilla Thunderbird.

### 2. Consentement Explicite (Opt-In) et Données Traitées
Magic Translator est un outil d'aide à la traduction permettant de traduire les e-mails directement dans le panneau de lecture de Thunderbird ainsi que dans la fenêtre de rédaction (Compose Mode).
- **Aucun fournisseur actif par défaut (Opt-In strict)** : À l'installation, aucun moteur de traduction n'est activé par défaut (`provider: "none"`). Aucune donnée n'est transmise sur le réseau tant que vous n'avez pas explicitement choisi votre fournisseur via l'assistant de premier lancement (`setup/setup.html`), le bandeau de consentement intégré en 1 clic, ou la page des Préférences.
- **Données transmises** : Après votre accord explicite et lorsque vous déclenchez une traduction, le contenu textuel du corps de l'e-mail ou du brouillon sélectionné est envoyé au moteur de traduction que vous avez choisi (**Google Translate**, **MyMemory**, **DeepL API**, **Google Gemini API**, fournisseurs **LLMs Cloud/Locaux** ou votre instance **LibreTranslate**).
- **Relais de secours MyMemory optionnel (Opt-In)** : Si vous choisissez Google Translate, vous pouvez activer ou désactiver explicitement la bascule automatique de secours vers le service gratuit **MyMemory** (Translated.net) en cas d'indisponibilité momentanée ou de quota dépassé chez Google.
- **En-têtes et métadonnées** : Les métadonnées de messagerie (expéditeur, destinataires, date) ne sont **pas** transmises. En mode rédaction, seul l'objet du message peut être transmis si la case « Objet » est expressément cochée par l'utilisateur. La détection linguistique préalable (mode Zéro-Clic) s'exécute **100% hors-ligne** en local via le moteur CLD2 intégré à Thunderbird.
- **Adresse e-mail optionnelle pour MyMemory** : L'utilisateur peut facultativement renseigner une adresse e-mail dans les options pour porter son quota gratuit MyMemory de 5 000 à 50 000 caractères par jour. Cette adresse est enregistrée localement et uniquement transmise comme paramètre technique d'identification auprès de l'API MyMemory (`&de=adresse`).
- **Chiffrement HTTPS strict & Flux direct** : Toutes les requêtes sont émises directement depuis votre client Thunderbird vers le fournisseur sélectionné via des liaisons chiffrées **`https://`**. Conformément aux exigences de sécurité de Mozilla Thunderbird, le protocole non chiffré `http://` est **strictement interdit** vers tout serveur distant ou réseau local (LAN) et n'est autorisé que sur votre propre machine locale (`localhost` / `127.0.0.1` / `[::1]`, sans jamais transmettre de clé d'API en clair). Aucun serveur intermédiaire propriétaire n'est utilisé par l'extension.

### 3. Stockage Local et Confidentialité
- Votre choix de moteur, vos clés d'API (DeepL, Gemini, OpenAI, Groq, Mistral, etc.), l'adresse e-mail optionnelle MyMemory et vos préférences de traduction sont enregistrés **exclusivement en local** sur votre machine via l'API sécurisée `browser.storage.local`.
- L'extension ne collecte aucune donnée personnelle, ne contient aucun traceur, aucun outil d'analyse (analytics) et aucune publicité.

### 4. Permissions requises et Justifications
- `scripting` & `messagesRead` : Nécessaires pour injecter l'interface de traduction dans le document du message ouvert et lire le texte à traduire en mode lecture.
- `compose` : Nécessaire pour lire le sujet et le corps du brouillon en cours de rédaction et y réinjecter la traduction validée sans altérer la mise en forme du document.
- `menus` : Permet d'ajouter les raccourcis contextuels (clic-droit pour activer/désactiver le traducteur ou ouvrir les options).
- `storage` : Permet de conserver localement votre consentement de fournisseur, vos préférences et vos clés d'API.
- `host_permissions` : Permet d'établir les connexions directes vers les API de traduction et d'IA autorisées (`translate-pa.googleapis.com`, `translate.googleapis.com`, `api.mymemory.translated.net`, `api-free.deepl.com`, `api.deepl.com`, `generativelanguage.googleapis.com`, `api.openai.com`, `api.groq.com`, `api.mistral.ai`, `libretranslate.com`, ou `localhost` / `127.0.0.1`).
- `optional_host_permissions` (`https://*/*`) : Utilisée strictement à la demande sur accord explicite de l'utilisateur pour autoriser un serveur LLM ou LibreTranslate personnalisé sécurisé en HTTPS (ex: DeepSeek, OpenRouter, proxy d'entreprise ou serveur privé HTTPS).

---

## 🇬🇧 English

### 1. Introduction and Commitment
The **Magic Translator** extension for Mozilla Thunderbird is developed by **MTF Karukera** with a strict commitment to user privacy, GDPR compliance, and Mozilla Thunderbird security policies.

### 2. Explicit Opt-In Consent and Data Processing
Magic Translator translates email messages directly within the Thunderbird reading pane and the compose window (Compose Mode).
- **No Default Provider Enabled (Strict Opt-In)**: Upon installation, no translation provider is enabled by default (`provider: "none"`). Zero network requests are made until you explicitly select and consent to a translation provider via the first-run onboarding wizard (`setup/setup.html`), the 1-click inline consent banner, or the Options page.
- **Transmitted Data**: Once you have given explicit consent and triggered a translation, the text content of the email body or draft is sent to the translation engine of your choice (**Google Translate**, **MyMemory**, **DeepL API**, **Google Gemini API**, **Cloud/Local LLMs**, or your self-hosted **LibreTranslate** instance).
- **Optional MyMemory Fallback (Explicit Opt-In)**: When using Google Translate, you can explicitly enable or disable the automatic fallback to the free **MyMemory** service (Translated.net) in case Google Translate is temporarily rate-limited or unreachable.
- **Headers & Metadata**: Email headers (sender, recipients, date) are **not** transmitted. In compose mode, the subject is only sent if explicitly checked by the user. Pre-translation language detection (Zero-Click mode) runs **100% offline** locally using Thunderbird's built-in CLD2 engine.
- **Optional Email for MyMemory**: Users may optionally configure an email address in settings to expand their free MyMemory daily quota from 5,000 to 50,000 characters. This address is stored locally and transmitted strictly as an API query parameter (`&de=email`) to MyMemory.
- **Strict HTTPS Encryption & Direct Communication**: All requests are sent directly from your Thunderbird client to the chosen service over encrypted **`https://`** connections. In accordance with Mozilla Thunderbird security requirements, unencrypted `http://` is **strictly forbidden** for any remote or LAN server and is permitted exclusively for local loopback addresses (`localhost` / `127.0.0.1` / `[::1]`, with API keys never sent over plain HTTP). No proprietary intermediate server or proxy is used by the extension.

### 3. Local Storage and Zero Telemetry
- Your provider consent, configuration (chosen engine, optional email, API keys) are stored **strictly locally** on your device using `browser.storage.local`.
- The extension collects zero personal data, includes zero telemetry or analytics trackers, and displays no ads.

### 4. Permissions Justification
- `scripting` & `messagesRead`: Required to inject the translation banner into the displayed email and read the text to translate in reading mode.
- `compose`: Required to read the draft subject and body in the composition window and re-inject the translated text cleanly.
- `menus`: Enables context menu shortcuts on the translate button.
- `storage`: Persists your provider opt-in consent, translation engine settings, and API keys locally.
- `host_permissions`: Enables direct network requests to the authorized translation and AI providers (`translate-pa.googleapis.com`, `translate.googleapis.com`, `api.mymemory.translated.net`, `api-free.deepl.com`, `api.deepl.com`, `generativelanguage.googleapis.com`, `api.openai.com`, `api.groq.com`, `api.mistral.ai`, `libretranslate.com`, or local `localhost` / `127.0.0.1`).
- `optional_host_permissions` (`https://*/*`): Strictly requested on-demand upon explicit user confirmation for custom self-hosted or third-party HTTPS endpoints (e.g. DeepSeek, OpenRouter, private corporate HTTPS servers).
