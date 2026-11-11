# Architecture — Magic Translator

Document de référence sur le fonctionnement interne de l'extension. Pour les consignes de travail et
le rituel de fin de sprint, voir **`CONTRIBUTING.md`**.

---

## 1. Vue d'ensemble

Magic Translator est une **extension Thunderbird Manifest V3** qui traduit le contenu d'un e-mail
*in situ* dans le panneau de lecture ainsi que les brouillons dans la fenêtre de rédaction, de manière réversible. Elle ne comporte aucune dépendance runtime externe (pas de bundler, pas de framework, pas d'Experiment API).

```
┌────────────────────────────────────────────────────────────────────────┐
│  Thunderbird (Manifest V3)                                             │
│                                                                        │
│   ┌─────────────────────────┐          ┌──────────────────────────┐    │
│   │  background.js          │          │  translator-injected.js  │    │
│   │  (Event Page privilégié)│◄────────►│  (script de contenu,     │    │
│   │                         │ runtime  │   DOM du message)        │    │
│   │  • registerScripts      │ message  │                          │    │
│   │  • bouton + menu        │ passing  │  • UI Shadow DOM         │    │
│   │  • keep-alive MV3 (20s) │          │  • Opt-In inline 1-clic  │    │
│   │  • mt-providers.js      │          │  • badge moteur temps    │    │
│   │    ├─ none (défaut ATN) │          │    réel                  │    │
│   │    ├─ Google Translate  │          │  • collecte/réinjection  │    │
│   │    │  └─ Fallback opt.  │          └──────────────────────────┘    │
│   │    │     MyMemory       │                                          │
│   │    ├─ MyMemory          │          ┌──────────────────────────┐    │
│   │    ├─ DeepL API         │◄────────►│  compose/compose.js      │    │
│   │    ├─ Google Gemini     │          │  options/options.js      │    │
│   │    ├─ LLM Hub OpenAI    │          │  setup/setup.js          │    │
│   │    └─ LibreTranslate    │          └──────────────────────────┘    │
│   └───────────┬─────────────┘                                          │
│               │ fetch direct (HTTPS / localhost & 127.0.0.1)           │
└───────────────┼────────────────────────────────────────────────────────┘
                ▼
   Endpoints de Traduction / IA (après consentement explicite Opt-In)
   (Google Translate-PA, MyMemory, DeepL, Google AI Studio, OpenAI, Groq, Mistral, Ollama, LM Studio...)
```

---

## 2. Contextes d'exécution

### 2.1 `background.js` — Event Page privilégiée

S'exécute dans le processus principal d'extension de Thunderbird. Seul contexte autorisé à émettre des requêtes réseau `fetch` vers les fournisseurs configurés.

Responsabilités :

1. **Cycle de vie MV3 non destructif** :
   - Sur `runtime.onInstalled` et `runtime.onStartup` : enregistrement propre de `mt-text.js` + `translator-injected.js` via `messenger.scripting.messageDisplay.registerScripts` (`magic-translator-v2`), recréation séquentielle des menus clic-droit (`menus.remove` puis `menus.create`), et purge sélective des clés orphelines de rédaction en excluant les onglets ouverts (`browser.tabs.query({})`).
   - Sur simple réveil d'Event Page : vérification légère et non destructive (`getRegisteredScripts`) sans désenregistrement inutile.
2. **Maintien en éveil (Keep-Alive MV3)** : pendant tout appel `MTProviders.traduire` potentiellement long (jusqu'à 60 s sur LLM local / CPU), un battement de cœur interne toutes les 20 s (`runtime.getPlatformInfo`) empêche la suspension prématurée de l'Event Page.
3. **Contrôle d'accès inter-contextes** : les actions d'administration (`testProvider`, `listGeminiModels`) vérifient que `sender.url` provient exclusivement de `options/options.html` et que l'origine réseau est couverte par `browser.permissions.contains`.
4. **Déduplication de l'assistant d'accueil** : `ouvrirOuActiverSetup()` réutilise et active tout onglet `setup/setup.html` déjà ouvert au lieu d'empiler des doublons.

### 2.2 `translator-injected.js` — script de contenu (Mode Lecture)

IIFE injectée dans le document du panneau de lecture. **N'a PAS** accès à `browser.i18n` ni au réseau cross-origin ; communique avec `background.js` par messages.

Responsabilités : construction de l'UI isolée dans un **Shadow DOM**, filet de sécurité d'Opt-In inline (`.mt-consent-bar` avec case optionnelle MyMemory), synchronisation temps réel de la configuration (`storage.onChanged`), collecte textuelle excluant toute chaîne d'ancêtres ignorée ou masquée, découpage par lots atomiques et restauration fidèle.

### 2.3 `compose/` — popup du Mode Rédaction (Compose Mode)

Module popup dédié (`compose.html`, `compose.js`, `compose.css` + `mt-text.js`) s'exécutant lors du clic sur `compose_action` dans la fenêtre de composition.

Responsabilités :
- Lecture du brouillon via `messenger.compose.getComposeDetails()`.
- Détection de la sélection active dans l'éditeur avec découpage par lots (`MTText.decouperLong`).
- Regroupement atomique Objet + Corps en une seule passe via sentinelle `MTSEP` lorsque les deux portées sont cochées, et support de la langue d'alternance (`alternateTarget`).
- Stockage éphémère en mémoire vive (`browser.storage.session`, avec repli `storage.local`) d'un instantané complet avant traduction (y compris lors d'une traduction de sélection) permettant une restauration 100 % déterministe en un clic, sans laisser de brouillon sur disque après fermeture de Thunderbird.

### 2.4 `options/` — page de préférences

Page d'options intégrée (`options.html`, `options.js`, `options.css`) 100 % internationalisée en 7 langues : validation stricte des champs obligatoires (`aria-invalid`), politique *fail-closed* sur les permissions d'hôtes (`assurerPermissionsHote`), conservation des modèles Gemini dynamiques, et interrogation de la liste Gemini uniquement lorsque Gemini est le moteur actif.

### 2.5 `setup/` — assistant de premier lancement & consentement explicite (Opt-In)

Page d'accueil dédiée (`setup.html`, `setup.js`, `setup.css`) ouverte automatiquement à la première installation (`provider === "none"` et `!onboardingShown`) :
- Informe clairement l'utilisateur des données transmises avant tout appel réseau.
- Permet d'activer **Google Translate** en 1 clic avec case à cocher optionnelle pour le relais de secours **MyMemory**, ou d'ouvrir la page complète des Options.
- Affiche dynamiquement l'état réel si un moteur est déjà actif lors d'une réouverture ultérieure.
- Si l'utilisateur ferme cet onglet sans faire de choix (`provider === "none"`), le **filet de sécurité inline** (`.mt-consent-bar` en lecture et `#consent-banner` en rédaction) propose la même activation 1 clic + case optionnelle MyMemory au moment où l'utilisateur clique sur « Traduire ».

---

## 3. Protocole de messages & Hub Multi-Fournisseurs

### Protocole de messages (`background.js` ↔ contextes UI)

| Sens | Message | Réponse |
|------|---------|---------|
| background → injected | `{ action: "toggleBanner", autoTranslate?: boolean }` | — (ouvre/ferme l'UI et traduit si 1-clic) |
| injected / compose → background | `{ action: "getConfig" }` | `{ success: true, provider, providerLabel, providerNom, consentRequired, consentementRequis, isConfigured, enableMyMemoryFallback, autoTranslateOnClick, alternateTarget, autoTranslateOnOpen, autoTranslateMode, autoTranslateLangs, preferLocalDetection }` |
| setup / injected / compose → background | `{ action: "acceptDefaultProvider", enableMyMemoryFallback?: boolean }` | `{ success: true, config }` (active `provider: "google"` avec le choix `enableMyMemoryFallback`) |
| options → background | `{ action: "openSetup" }` | `{ success: true }` (ouvre ou active l'onglet unique `setup/setup.html`) |
| injected → background | `{ action: "detectLanguage", text }` | `{ success: true, language, isReliable, languages }` (CLD2 local hors-ligne, sentinelles `MTSEP` purgées) |
| options → background | `{ action: "testProvider", config }` | `{ success: boolean, message: string }` (restreint à `options/options.html`, sans fallback MyMemory) |
| options → background | `{ action: "listGeminiModels", apiKey }` | `{ success: boolean, models }` (restreint à `options/options.html`) |
| injected / compose → background | `{ action: "translate", text, source, target }` | `{ success: true, text, detectedLang, provider, providerLabel, providerNom, usedFallback }` ou `{ success: false, error }` (`CONSENT_REQUIRED`, `CLEARTEXT_FORBIDDEN`, `SERVICE_UNAVAILABLE`, etc.) |

### Hub Multi-Fournisseurs (`mt-providers.js`)

- **Timeouts différenciés** : `TIMEOUT_CLOUD_MS = 10000` (10 s) pour les services Cloud ; `TIMEOUT_LOCAL_MS = 60000` (60 s) pour LibreTranslate et les moteurs locaux (Ollama, LM Studio, serveurs personnalisés).
- **Politique *fail-closed* stricte** :
  - `obtenirFournisseur("none")` ou identifiant inconnu retourne `null` ; `traduireAvecFournisseur()` lève `CONSENT_REQUIRED` sans émettre la moindre requête réseau.
  - `obtenirPatternOrigine()` retourne `""` sur URL invalide ou HTTP hors loopback ; `FournisseurLibreTranslate` et `FournisseurOpenAICompatible` refusent les URLs vides (`INVALID_URL`).
- **Parité 1:1 HTTPS & Loopback (`estHoteLoopback` & `validerUrlSecurisee`)** :
  - Les URLs `https://` sont autorisées partout (avec `optional_host_permissions: ["https://*/*"]`).
  - Les URLs `http://` sont strictement restreintes à `localhost` et `127.0.0.1`, en parité exacte avec `host_permissions` et la directive CSP `connect-src https: http://localhost:* http://127.0.0.1:*` de `manifest.json`. Toute adresse LAN ou distante en `http://` lève `CLEARTEXT_FORBIDDEN`. Aucune clé d'API n'est jamais transmise sur `http://`.
- **Découpage UTF-8 en octets (`decouperParOctetsUtf8`)** :
  - **Google Translate (`google`)** : `GET https://translate-pa.googleapis.com/v1/translate?key=<PUBLIC_CLIENT_KEY>&params.client=gtx&...`, sous-découpé par octets UTF-8 (`<= 3600` octets) pour prévenir toute erreur HTTP 414 sur les textes CJK/cyrilliques/arabes. Relais optionnel vers MyMemory uniquement si `enableMyMemoryFallback === true` (et désactivé lors de `testerConnexion`), en remontant `effectiveProvider: "mymemory"` et `usedFallback: true`.
  - **MyMemory (`mymemory`)** : `GET https://api.mymemory.translated.net/get`, sous-découpé par octets UTF-8 (`<= 450` octets) pour respecter la limite serveur de 500 octets (`QUERY LENGTH LIMIT` normalisé en `SERVICE_UNAVAILABLE`).
  - **Google Gemini (`gemini`) & Hub LLMs (`llm`)** : encapsulation du message dans `<source_text>...</source_text>` avec indication explicite de la langue source et nettoyage symétrique dans `nettoyerReponseLLM`.

---

## 4. Cycle de vie, Accessibilité & Sécurité DOM

- **État isolé par instance (`_mtSeq`)** : dans `translator-injected.js`, l'ensemble de l'état et des timers (`timersInstance`) vit dans la portée de chaque instance et est intégralement annulé par `nettoyerInstance()` lors du passage rapide d'un e-mail à un autre.
- **Collecte DOM exhaustive** : `collecterNoeudsTexte` et `extraireTextePourDetection` remontent toute la chaîne d'ancêtres jusqu'à `racine` pour exclure `SCRIPT`, `STYLE`, `NOSCRIPT`, `TEMPLATE`, `CODE`, `PRE` (hors message texte brut), ainsi que tout ancêtre `[hidden]`, `[aria-hidden="true"]` ou `display: none`.
- **Accessibilité WCAG 2.1 AA** :
  - Contrastes vérifiés `>= 4.5:1` sur tous les boutons primaires (`#6d28d9` / `#4f46e5`), bandeaux glassmorphism (`rgba(15, 23, 42, 0.93)`), interrupteurs `role="switch"` en thème clair et sombre, et contours `:focus-visible`.
  - Régions `role="status" aria-live="polite"` maintenues dans l'arbre ARIA dès le montage initial, absence de vol de focus en Mode Zéro-Clic, et restitution du focus clavier à la fermeture par `Escape` ou repli.
- **Sécurité DOM stricte** : zéro `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval` ou `new Function`. Manipulation exclusive via `textContent`, `createTextNode` et `DOMParser`.
