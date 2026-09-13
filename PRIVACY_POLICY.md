# Politique de Confidentialité / Privacy Policy — Magic Translator

**Dernière mise à jour / Last updated** : 14 septembre 2026

---

## 🇫🇷 Français

### 1. Préambule et Engagements
L'extension **Magic Translator** pour Mozilla Thunderbird est développée par **MTF Karukera** dans le respect strict de la vie privée des utilisateurs et du Règlement Général sur la Protection des Données (RGPD).

### 2. Données traitées et Finalité
Magic Translator est un outil d'aide à la traduction permettant de traduire les e-mails directement dans le panneau de lecture de Thunderbird ainsi que dans la fenêtre de rédaction (Compose Mode).
- **Données transmises** : Lorsque vous cliquez sur « Traduire », le contenu textuel du corps ou du brouillon de l'e-mail sélectionné est envoyé au moteur de traduction choisi par l'utilisateur (Google Translate par défaut, MyMemory, DeepL API, Google Gemini API, fournisseurs LLMs Cloud/Locaux ou votre propre instance LibreTranslate). En cas d'indisponibilité momentanée du service Google Translate (limitation de débit ou erreur réseau), une bascule automatique de secours est opérée en toute transparence vers le service gratuit MyMemory (Translated.net) pour assurer la continuité de service.
- **En-têtes et métadonnées** : Les métadonnées de messagerie (expéditeur, destinataires, date) ne sont **pas** transmises. En mode rédaction, seul l'objet du message peut être transmis si la case « Objet » est expressément cochée par l'utilisateur.
- **Adresse e-mail optionnelle pour MyMemory** : L'utilisateur peut facultativement renseigner une adresse e-mail dans les options pour porter son quota gratuit MyMemory de 5 000 à 50 000 caractères par jour. Cette adresse est enregistrée localement et uniquement transmise comme paramètre technique d'identification auprès de l'API MyMemory (`&de=adresse`).
- **Flux direct** : Toutes les requêtes sont émises directement depuis votre client Thunderbird vers le fournisseur sélectionné via des liaisons chiffrées HTTPS (ou HTTP local pour Ollama/LM Studio). Aucun serveur intermédiaire propriétaire n'est utilisé par l'extension.

### 3. Stockage Local et Confidentialité
- Les clés d'API (DeepL, Gemini, OpenAI, Groq, Mistral, etc.), l'adresse e-mail optionnelle MyMemory et les préférences de traduction sont enregistrées **exclusivement en local** sur votre machine via l'API sécurisée `browser.storage.local`.
- L'extension ne collecte aucune donnée personnelle, ne contient aucun traceur, aucun outil d'analyse (analytics) et aucune publicité.

### 4. Permissions requises et Justifications
- `scripting` & `messagesRead` : Nécessaires pour injecter l'interface de traduction dans le document du message ouvert et lire le texte à traduire en mode lecture.
- `compose` : Nécessaire pour lire le sujet et le corps du brouillon en cours de rédaction et y réinjecter la traduction validée sans altérer la mise en forme du document.
- `menus` : Permet d'ajouter les raccourcis contextuels (clic-droit pour activer/désactiver le traducteur ou ouvrir les options).
- `storage` : Permet de conserver localement vos préférences de moteur de traduction et vos clés d'API.
- `host_permissions` : Permet d'établir les connexions directes vers les API de traduction et d'IA autorisées (`translate-pa.googleapis.com`, `translate.googleapis.com`, `api.mymemory.translated.net`, `api-free.deepl.com`, `api.deepl.com`, `generativelanguage.googleapis.com`, `api.openai.com`, `api.groq.com`, `api.mistral.ai`, `libretranslate.com`, ou endpoints locaux).
- `optional_host_permissions` (`*://*/*`) : Utilisée strictement à la demande sur accord explicite de l'utilisateur pour autoriser un serveur LLM personnalisé (ex: DeepSeek, OpenRouter, proxy d'entreprise ou serveur privé).

---

## 🇬🇧 English

### 1. Introduction and Commitment
The **Magic Translator** extension for Mozilla Thunderbird is developed by **MTF Karukera** with a strict commitment to user privacy and data protection.

### 2. Data Processing and Purpose
Magic Translator translates email messages directly within the Thunderbird reading pane and the compose window (Compose Mode).
- **Transmitted Data**: When you click "Translate", the text content of the email body or draft is sent to the translation engine of your choice (Google Translate by default, MyMemory, DeepL API, Google Gemini API, Cloud/Local LLMs, or your self-hosted LibreTranslate instance). If Google Translate becomes temporarily unavailable (rate limiting or network issue), a transparent automatic fallback to the free MyMemory service (Translated.net) takes over to ensure uninterrupted translation.
- **Headers & Metadata**: Email headers (sender, recipients, date) are **not** transmitted. In compose mode, the subject is only sent if explicitly checked by the user.
- **Optional Email for MyMemory**: Users may optionally configure an email address in settings to expand their free MyMemory daily quota from 5,000 to 50,000 characters. This address is stored locally and transmitted strictly as an API query parameter (`&de=email`) to MyMemory.
- **Direct Communication**: All requests are sent directly from your Thunderbird client to the chosen service over secure HTTPS (or local HTTP for Ollama/LM Studio). No proprietary intermediate server or proxy is used by the extension.

### 3. Local Storage and Zero Telemetry
- Your configuration (chosen engine, optional email, API keys) is stored **strictly locally** on your device using `browser.storage.local`.
- The extension collects zero personal data, includes zero telemetry or analytics trackers, and displays no ads.

### 4. Permissions Justification
- `scripting` & `messagesRead`: Required to inject the translation banner into the displayed email and read the text to translate in reading mode.
- `compose`: Required to read the draft subject and body in the composition window and re-inject the translated text cleanly.
- `menus`: Enables context menu shortcuts on the translate button.
- `storage`: Persists your translation engine settings and API keys locally.
- `host_permissions`: Enables direct network requests to the authorized translation and AI providers (`translate-pa.googleapis.com`, `translate.googleapis.com`, `api.mymemory.translated.net`, `api-free.deepl.com`, `api.deepl.com`, `generativelanguage.googleapis.com`, `api.openai.com`, `api.groq.com`, `api.mistral.ai`, `libretranslate.com`, or custom local endpoints).
- `optional_host_permissions` (`*://*/*`): Strictly requested on-demand upon explicit user confirmation for custom self-hosted or third-party OpenAI-compatible endpoints (e.g. DeepSeek, OpenRouter, private corporate servers).
