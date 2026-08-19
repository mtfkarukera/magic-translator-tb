# ✉️ Magic Translator — Extension Thunderbird

[![Version](https://img.shields.io/badge/version-v2.3.4-7c3aed)](https://github.com/mtfkarukera/magic-translator-tb/releases/latest)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

Extension de traduction intégrée pour Mozilla Thunderbird. Traduit les e-mails directement dans le **panneau de lecture** et dans la **fenêtre de rédaction (Compose Mode)** avec une interface Glassmorphism élégante et discrète.

## ✨ Fonctionnalités

### 📖 1. Mode Lecture (Panneau de Message)
- **Bouton dédié dans la barre de message** — bouton **Traduire** aux côtés de Répondre, Transférer, Archiver…
- **Badge Moteur Interactif & Statut Réel** — Visualisation immédiate du moteur actif, statut réel connecté (voyant vert `●` ou alerte orange `●`), et autorisation réseau en 1 clic.
- **Menu clic-droit** sur le bouton **Traduire** — Activer / Désactiver le traducteur et accès direct aux **Options**.
- **Flux UX épuré** — Traduction in situ réversible sans élément résiduel obstruant la lecture.
- **Raccourci clavier** — `Alt+Shift+T` par défaut (remappable).

### ✍️ 2. Mode Rédaction (Fenêtre de Composition)
- **Bouton MT dédié** dans la barre d'outils de rédaction (aux côtés de LanguageTool, Envoyer, etc.).
- **Popup Glassmorphism adaptatif** — Interface fluide s'ajustant automatiquement au thème clair ou sombre de Thunderbird.
- **Traduction de l'Objet et/ou du Corps** — Choix du périmètre de traduction avec cases à cocher dédiées.
- **Traduction de la Sélection active** — Détection automatique du texte surligné dans l'éditeur pour un remplacement chirurgical in situ.
- **Réversibilité totale** — Bouton **Restaurer l'original** pour retrouver l'état initial en un clic.

### 🌐 3. Hub Multi-Fournisseurs & LLMs
- **Google Translate** (*par défaut*, gratuit, zéro configuration)
- **DeepL API** (*Free & Pro*, qualité linguistique professionnelle)
- **Google Gemini API** (*Cloud IA*, `gemini-3.5-flash-lite`, ultra-rapide et intelligent)
- **Hub LLMs OpenAI-Compatible** (*Cloud & Local*) :
  - **OpenAI** (`gpt-4o-mini`, `gpt-4o`)
  - **Groq Cloud** (`llama-3.3-70b-versatile` — inférence instantanée)
  - **Mistral AI** (`mistral-small-latest`)
  - **Ollama** (`http://localhost:11434`, traduction 100% locale)
  - **LM Studio** (`http://localhost:1234`, traduction 100% locale)
  - **Serveur Personnalisé** (vLLM, etc.)
- **LibreTranslate** (*Open source*, support des serveurs auto-hébergés / locaux)

### 🎨 4. Design, Accessibilité & Internationalisation
- **Page d'options 100% multilingue** — Traduction complète de l'extension et des options en **7 langues** (`en`, `fr`, `de`, `es`, `ja`, `pt`, `vi`).
- **Isolation stricte** — Shadow DOM dans le panneau de lecture et API native `messenger.compose` sans injection polluante en rédaction.
- **Accessibilité WCAG AA** — Contrastes optimisés, navigation clavier et micro-animations fluides.

## 📋 Prérequis

- Mozilla Thunderbird **128.0** ou supérieur (testé sur 153.0.3)
- Connexion Internet (pour l'API Google Translate ou LLMs Cloud) ou serveur local actif (Ollama, LM Studio)

## 🚀 Installation

### Mode développement
1. Ouvrir Thunderbird
2. Menu **Outils → Outils de développement → Déboguer les modules complémentaires**
3. Cliquer sur **Charger un module complémentaire temporaire…**
4. Sélectionner le fichier `manifest.json` de ce répertoire

### Mode production
1. Télécharger le fichier `.xpi` depuis la [dernière release GitHub](https://github.com/mtfkarukera/magic-translator-tb/releases/latest)
2. Dans Thunderbird : **Outils → Modules complémentaires et thèmes**
3. Cliquer sur ⚙️ → **Installer un module depuis un fichier…**
4. Sélectionner le fichier `.xpi` téléchargé

## 🎯 Utilisation

### En Mode Lecture :
1. Sélectionnez un e-mail dans Thunderbird.
2. Cliquez sur le bouton **Traduire** dans la barre de message (ou faites `Alt+Shift+T`).
3. Le bandeau s'ouvre : choisissez la langue cible et cliquez sur **Traduire**.
4. Cliquez sur **Original** pour restaurer le texte initial à tout moment.

### En Mode Rédaction :
1. Rédigez votre e-mail dans la fenêtre de composition (en français ou votre langue habituelle).
2. Cliquez sur le bouton **MT** dans la barre d'outils de rédaction (ou faites `Alt+Shift+T`).
3. Le popup Glassmorphism s'ouvre : choisissez la langue cible (ex: English, Deutsch).
4. Cochez les éléments à traduire (Objet, Corps entier, ou Sélection active).
5. Cliquez sur **Traduire le message** ➔ Le texte est mis à jour in situ !
6. Cliquez sur **Restaurer l'original** si vous souhaitez revenir à votre brouillon initial.

> **Raccourci clavier :** `Alt+Shift+T` (par défaut, **remappable**) affiche / masque le traducteur, comme le bouton de la barre.

## ⚠️ Incompatibilités connues

### Thunderbird Conversations

> **⚠️ INCOMPATIBILITÉ CRITIQUE** — Magic Translator n'est actuellement **pas compatible** avec l'extension [Thunderbird Conversations](https://addons.thunderbird.net/thunderbird/addon/gmail-conversation-view/).
>
> Lorsque les deux extensions sont actives simultanément, le bandeau de traduction ne s'affiche pas et l'interface de Conversations peut être perturbée.
>
> **Solution temporaire :** Désactivez Thunderbird Conversations pour utiliser Magic Translator.
>
> **Alternative / Solution dédiée :** L'extension [Magic Threads](https://addons.thunderbird.net/fr/thunderbird/addon/magic-threads/) ([dépôt GitHub](https://github.com/mtfkarukera/magic-threads/tree/main)) a été spécialement développée pour traiter cette incompatibilité avec Thunderbird Conversations. N'hésitez pas à l'installer et à la tester si vous souhaitez en profiter.
>
> **Prochaines étapes :** La compatibilité native de Magic Translator avec Thunderbird Conversations reste prévue dans une version future. Le mécanisme d'injection (Experiment API + observateur `content-document-global-created`) est identifié mais nécessite un travail supplémentaire pour coexister correctement avec l'architecture iframe de Conversations.

## 🏗️ Architecture

```
magic-translator-tb/
├── manifest.json              # Manifest V3 Thunderbird (permissions, options_ui, host_permissions)
├── background.js              # Script d'arrière-plan (enregistrement + bouton barre + routage traduction)
├── mt-providers.js            # Adaptateurs de traduction (Google, DeepL API, LibreTranslate)
├── translator-injected.js     # Script injecté dans le panneau de message (UI Shadow DOM + badge moteur)
├── mt-text.js                 # Helpers de texte purs (testables ; injecté avant l'UI)
├── options/                   # Page de configuration des options
│   ├── options.html           # Interface utilisateur en Dark Glassmorphism
│   ├── options.css            # Styles autonomes et accessibles WCAG AA
│   └── options.js             # Logique de chargement, test et persistance storage.local
├── icon.png                   # Icône de l'extension (128×128)
├── build.sh                   # Packaging reproductible du XPI (→ dist/)
├── LICENSE                    # Licence MPL-2.0
├── README.md
├── ARCHITECTURE.md            # Architecture détaillée
├── CHANGELOG.md               # Journal des versions
├── SECURITY.md                # Politique de sécurité et flux de données
├── CONTRIBUTING.md            # Guide de contribution
├── eslint.config.js           # Configuration ESLint (flat config)
├── package.json               # Métadonnées npm, scripts (lint/test/build) et devDependencies
├── test/                      # Tests unitaires (node:test)
│   ├── text.test.js           # Tests des helpers de texte
│   └── providers.test.js      # Tests des adaptateurs de fournisseurs
└── _locales/                  # Fichiers de localisation (manifest uniquement)
```

### Flux de données

```
[Utilisateur clique [T] dans la barre de message]
    ↓
background.js → messageDisplayAction.onClicked
    → tabs.sendMessage({ action: "toggleBanner" })
    ↓
translator-injected.js reçoit "toggleBanner"
    → ouvre le bandeau (ou ferme tout si déjà ouvert)
    ↓
Clic « Traduire »
    ↓
browser.runtime.sendMessage({ action: "translate", ... })
    ↓
background.js → fetch() → Google Translate API (gtx)
    ↓
Réponse { success, text, detectedLang }
    ↓
Texte traduit injecté dans le DOM du message
Bandeau se referme proprement (zéro résidu sur l'e-mail)
Clic [Traduire] ou bouton barre → réaffiche le bandeau pour restaurer l'original ou changer de langue
```

## 🌐 Langues de l'interface

| Code | Langue |
|------|--------|
| `fr` | Français (par défaut) |
| `en` | English (fallback universel) |
| `es` | Español |
| `de` | Deutsch |
| `ja` | 日本語 |
| `pt` | Português |
| `vi` | Tiếng Việt |

## 📄 Licence

Mozilla Public License 2.0 (MPL-2.0)

## 🔒 Confidentialité des données

Magic Translator **ne fait aucune télémétrie** et **ne transmet rien à ses développeurs** ni à un quelconque serveur du projet (il n'existe aucun serveur Magic Translator).

**Partage avec Google Translate :**  
Pour fonctionner, l'extension envoie le **contenu du corps des e-mails que vous choisissez de traduire** à l'API de Google Translate (client `gtx`). Ces données transitent *exclusivement et directement* entre votre client Thunderbird et les serveurs de Google (HTTPS). Seul le **corps rendu** du message est transmis : les en-têtes gérés par Thunderbird (expéditeur, destinataire, sujet) sont hors du document de contenu et ne sont pas collectés — sauf s'ils figurent dans le corps même du message. À ce titre, le manifest déclare la catégorie de collecte **`personalCommunications`** (contenu de messages transmis à un tiers), conformément au cadre de consentement de Mozilla.

## 🤝 Contribution

Les contributions sont bienvenues, en particulier pour :
- La compatibilité avec Thunderbird Conversations
- Le support de moteurs de traduction alternatifs (DeepL, LibreTranslate)
- De nouvelles langues d'interface

---
*Développé par **MTF Karukera**. Découvre toutes les solutions logicielles et outils de productivité de la suite **magic-softs** sur [magic-clipper.mtfk.fr](https://magic-clipper.mtfk.fr/).*
