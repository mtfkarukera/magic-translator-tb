# ✉️ Magic Translator — Extension Thunderbird

[![Version](https://img.shields.io/badge/version-v2.0.15-7c3aed)](https://github.com/mtfkarukera/magic-translator-tb/releases/latest)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

Extension de traduction intégrée pour Mozilla Thunderbird. Traduit les e-mails directement dans le panneau de lecture avec une interface élégante et discrète.

## ✨ Fonctionnalités

- **Bouton dédié dans la barre de message** — bouton **Traduire** aux côtés de Répondre, Transférer, Archiver…
- **Menu clic-droit** sur le bouton **Traduire** — Activer / Désactiver le traducteur
- **Activation à la demande** — Aucune ressource consommée tant que l'utilisateur n'ouvre pas le traducteur
- **Flux UX fluide** : `Rien → [Traduire] → Bandeau → (traduction) → Pilule → [Traduire] → Rien`
- **Logo [MT] cliquable** dans le bandeau — referme le bandeau en pilule d'un seul clic
- **Bouton ▴ circulaire** pour replier le bandeau — dimensionné comme les sélecteurs de langue, facile à cibler
- **Titre du bouton barre traduit** selon la langue de Thunderbird (Traduire / Translate / Traducir / Übersetzen / Dịch)
- **Auto-détection** de la langue source
- **30+ langues** supportées (français, anglais, espagnol, allemand, vietnamien, japonais, arabe, etc.)
- **Restauration** du texte original en un clic
- **Raccourci clavier** : `Alt+Shift+T` par défaut — **remappable** dans les paramètres de Thunderbird (Modules → ⚙️ → Gérer les raccourcis), et sans collision avec « rouvrir l'onglet »
- **Interface i18n** — L'UI s'adapte à la langue de Thunderbird (FR, EN, ES, DE, VI, JA, PT) ; **fallback anglais** pour toute autre langue
- **Design sobre et élégant** — Dark glassmorphism, animations fluides, Shadow DOM isolé
- **Support texte brut** — Les e-mails en texte brut (`<pre>`) sont traduits intégralement

## 📋 Prérequis

- Mozilla Thunderbird **128.0** ou supérieur (testé sur 151.0.1)
- Connexion Internet (pour l'API Google Translate)

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

1. Sélectionnez un e-mail dans Thunderbird
2. Cliquez sur le bouton **Traduire** dans la barre de message
3. Le bandeau de traduction s'ouvre — choisissez la langue source (ou laissez « Auto-détection ») et la langue cible
4. Cliquez sur **Traduire**
5. Le bandeau se replie automatiquement après la traduction (la pilule `[MT ▸ ✓]` reste visible)
6. Pour replier le bandeau à tout moment : cliquez sur le logo **[MT]** ou sur le bouton **▴** circulaire (en haut à droite du bandeau)
7. Pour restaurer le texte original, rouvrez le bandeau et cliquez sur **Original**
8. Pour fermer complètement le traducteur, cliquez à nouveau sur **Traduire** dans la barre (ou clic droit → Désactiver)

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
├── manifest.json              # Manifest V3 Thunderbird
├── background.js              # Script d'arrière-plan (enregistrement + bouton barre + proxy traduction)
├── translator-injected.js     # Script injecté dans le panneau de message (UI + logique)
├── mt-text.js                 # Helpers de texte purs (testables ; injecté avant l'UI)
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
├── test/                      # Tests unitaires (node:test) des helpers purs
├── .claude/skills/            # Skills Claude Code (fin-de-sprint, build-xpi, revue-securite…)
└── _locales/                  # Fichiers de localisation (manifest uniquement)
    ├── fr/messages.json       # Français
    ├── en/messages.json       # Anglais (fallback universel)
    ├── es/messages.json       # Espagnol
    ├── de/messages.json       # Allemand
    ├── ja/messages.json       # Japonais
    ├── pt/messages.json       # Portugais
    └── vi/messages.json       # Vietnamien
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
Bandeau se referme → Pilule [MT ▸ ✓] visible
Clic logo [MT] ou bouton ▴ → replie en pilule
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
