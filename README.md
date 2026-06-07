# ✉️ Magic Translator — Extension Thunderbird

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
- **Raccourci clavier** : `Ctrl+Shift+T` (Mac : `⌃⇧T`) — fonctionne quand le panneau de lecture a le focus
- **Interface i18n** — L'UI s'adapte à la langue de Thunderbird (FR, EN, ES, DE, VI)
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
1. Télécharger le fichier `.xpi` depuis la [dernière release GitHub](https://github.com/mtfkarukera/magic-translator/releases/latest)
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

> **Raccourci clavier :** `Ctrl+Shift+T` ouvre directement le bandeau sans passer par le bouton barre.

## ⚠️ Incompatibilités connues

### Thunderbird Conversations

> **⚠️ INCOMPATIBILITÉ CRITIQUE** — Magic Translator n'est actuellement **pas compatible** avec l'extension [Thunderbird Conversations](https://addons.thunderbird.net/thunderbird/addon/gmail-conversation-view/).
>
> Lorsque les deux extensions sont actives simultanément, le bandeau de traduction ne s'affiche pas et l'interface de Conversations peut être perturbée.
>
> **Solution temporaire :** Désactivez Thunderbird Conversations pour utiliser Magic Translator.
>
> **Prochaines étapes :** La compatibilité avec Thunderbird Conversations est prévue dans une version future. Le mécanisme d'injection (Experiment API + observateur `content-document-global-created`) est identifié mais nécessite un travail supplémentaire pour coexister correctement avec l'architecture iframe de Conversations.

## 🏗️ Architecture

```
magic-translator/
├── manifest.json              # Manifest V3 Thunderbird
├── background.js              # Script d'arrière-plan (enregistrement + bouton barre + proxy traduction)
├── translator-injected.js     # Script injecté dans le panneau de message (UI + logique)
├── icon.png                   # Icône de l'extension (128×128)
├── LICENSE                    # Licence MPL-2.0
├── README.md
├── eslint.config.js           # Configuration ESLint (flat config)
├── package.json               # Métadonnées npm et devDependencies (ESLint)
└── _locales/                  # Fichiers de localisation (manifest uniquement)
    ├── fr/messages.json       # Français (par défaut)
    ├── en/messages.json       # Anglais
    ├── es/messages.json       # Espagnol
    ├── de/messages.json       # Allemand
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
| `en` | English |
| `es` | Español |
| `de` | Deutsch |
| `vi` | Tiếng Việt |

## 📄 Licence

Mozilla Public License 2.0 (MPL-2.0)

## 🔒 Confidentialité des données

Magic Translator ne collecte, ne stocke, ni ne transmet **aucune donnée personnelle ou télémétrique** à ses développeurs ou serveurs tiers.

**Partage avec Google Translate :**  
Pour fonctionner, l'extension envoie le contenu des e-mails que vous choisissez de traduire à l'API de Google Translate (client `gtx`). Ces données transitent *exclusivement et directement* entre votre client Thunderbird et les serveurs de Google (via une connexion sécurisée HTTPS). En aucun cas ces informations ne transitent par nous.

## 🤝 Contribution

Les contributions sont bienvenues, en particulier pour :
- La compatibilité avec Thunderbird Conversations
- Le support de moteurs de traduction alternatifs (DeepL, LibreTranslate)
- De nouvelles langues d'interface
