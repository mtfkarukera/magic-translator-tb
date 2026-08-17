# Politique de Confidentialité / Privacy Policy — Magic Translator

**Dernière mise à jour / Last updated** : 17 août 2026

---

## 🇫🇷 Français

### 1. Préambule et Engagements
L'extension **Magic Translator** pour Mozilla Thunderbird est développée par **MTF Karukera** dans le respect strict de la vie privée des utilisateurs et du Règlement Général sur la Protection des Données (RGPD).

### 2. Données traitées et Finalité
Magic Translator est un outil d'aide à la lecture permettant de traduire les e-mails directement dans Thunderbird.
- **Données transmises** : Lorsque vous cliquez sur « Traduire », le contenu textuel du corps de l'e-mail sélectionné est envoyé au moteur de traduction choisi par l'utilisateur (Google Translate par défaut, DeepL API, ou votre propre instance LibreTranslate).
- **En-têtes et métadonnées** : Les métadonnées de messagerie (expéditeur, destinataires, date, sujet dans l'en-tête natif) ne sont **pas** transmises.
- **Flux direct** : Toutes les requêtes sont émises directement depuis votre client Thunderbird vers le fournisseur de traduction sélectionné via des liaisons chiffrées HTTPS. Aucun serveur intermédiaire n'est utilisé par l'extension.

### 3. Stockage Local et Confidentialité
- Les clés d'API (ex: DeepL) et les préférences de traduction sont enregistrées **exclusivement en local** sur votre machine via l'API sécurisée `browser.storage.local`.
- L'extension ne collecte aucune donnée personnelle, ne contient aucun traceur, aucun outil d'analyse (analytics) et aucune publicité.

### 4. Permissions requises et Justifications
- `scripting` & `messagesRead` : Nécessaires pour injecter l'interface de traduction dans le document du message ouvert et lire le texte à traduire.
- `menus` : Permet d'ajouter les raccourcis contextuels (clic-droit pour activer/désactiver le traducteur ou ouvrir les options).
- `storage` : Permet de conserver localement vos préférences de moteur de traduction et vos clés d'API.
- `host_permissions` : Permet d'établir les connexions directes vers les API de traduction (`translate.googleapis.com`, `api-free.deepl.com`, `api.deepl.com`, ou instance personnalisée).

---

## 🇬🇧 English

### 1. Introduction and Commitment
The **Magic Translator** extension for Mozilla Thunderbird is developed by **MTF Karukera** with a strict commitment to user privacy and data protection.

### 2. Data Processing and Purpose
Magic Translator translates email messages directly within the Thunderbird reading pane.
- **Transmitted Data**: When you click "Translate", the rendered text content of the email body is sent to the translation engine of your choice (Google Translate by default, DeepL API, or your self-hosted LibreTranslate instance).
- **Headers & Metadata**: Email headers (sender, recipients, date, native subject) are **not** transmitted.
- **Direct Communication**: All requests are sent directly from your Thunderbird client to the chosen translation service over secure HTTPS connections. No intermediate server or third-party proxy is used by the extension.

### 3. Local Storage and Zero Telemetry
- Your configuration (chosen engine, API keys) is stored **strictly locally** on your device using `browser.storage.local`.
- The extension collects zero personal data, includes zero telemetry or analytics trackers, and displays no ads.

### 4. Permissions Justification
- `scripting` & `messagesRead`: Required to inject the translation banner into the displayed email and read the text to translate.
- `menus`: Enables context menu shortcuts on the translate button.
- `storage`: Persists your translation engine settings and API keys locally.
- `host_permissions`: Enables direct HTTPS network requests to the authorized translation providers (`translate.googleapis.com`, `api-free.deepl.com`, `api.deepl.com`, or custom endpoints).
