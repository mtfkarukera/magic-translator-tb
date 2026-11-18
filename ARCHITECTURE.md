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

1. **Cycle de vie MV3 non destructif & Isolation d'onglet** :
   - Sur `runtime.onInstalled` et `runtime.onStartup` : enregistrement propre de `mt-text.js` + `translator-injected.js` via `messenger.scripting.messageDisplay.registerScripts` (`magic-translator-v2`), recréation séquentielle des menus clic-droit (`menus.remove` puis `menus.create`), et purge sélective des clés orphelines de rédaction en excluant les onglets ouverts (`browser.tabs.query({})`).
   - Sur simple réveil d'Event Page : vérification légère et non destructive (`getRegisteredScripts`) sérialisée par le verrou `verrouScripts` sans désenregistrement inutile.
   - Le déclenchement du bandeau (`envoyerToggleBanner` et commande `Alt+Shift+T`) vérifie `estOngletLectureValide(tabId)` (`mail` ou `messageDisplay` avec un message réellement affiché) et déduplique les appels concurrents (`togglesEnVol`) afin de ne jamais injecter l'UI de lecture dans un brouillon (`Alt+Shift+M` dédié à la rédaction).
2. **Maintien en éveil (Keep-Alive MV3)** : pendant tout appel `MTProviders.traduire` potentiellement long (jusqu'à 60 s sur LLM local / CPU), un battement de cœur interne toutes les 20 s (`runtime.getPlatformInfo`) ainsi qu'un ping inter-contextes toutes les 18 s (`{ action: "ping" }`) empêchent la suspension prématurée de l'Event Page.
3. **Contrôle d'accès inter-contextes & Opt-In strict** : les actions d'administration (`testProvider`, `listGeminiModels`) vérifient que `sender.url` provient exclusivement de `options/options.html` et que l'origine réseau est couverte par `browser.permissions.contains` (également vérifié avant tout secours MyMemory). En mode `preferLocalDetection`, lorsque `source === "auto"` et que la langue détectée localement équivaut à `target`, un court-circuit renvoie le texte sans appel réseau superflu afin de préserver la bascule `alternateTarget`.
4. **Déduplication de l'assistant d'accueil** : `ouvrirOuActiverSetup()` réutilise et active tout onglet `setup/setup.html` déjà ouvert au lieu d'empiler des doublons.

### 2.2 `translator-injected.js` — script de contenu (Mode Lecture)

IIFE injectée dans le document du panneau de lecture. **N'a PAS** accès à `browser.i18n` ni au réseau cross-origin ; communique avec `background.js` par messages.

Responsabilités : construction de l'UI isolée dans un **Shadow DOM**, filet de sécurité d'Opt-In inline (`.mt-consent-bar` avec case optionnelle MyMemory décochée par défaut), garde anti-double injection `_mtBodyBound`, synchronisation temps réel de la configuration (`storage.onChanged`), collecte textuelle excluant toute chaîne d'ancêtres ignorée, `aria-hidden="true"` ou masquée par CSS (`getComputedStyle` avec cache `WeakMap`), découpage par lots atomiques (et court-circuit avant écriture DOM dès le lot `0` si déjà dans la cible en Mode Zéro-Clic), et restauration fidèle.

### 2.3 `compose/` — popup du Mode Rédaction (Compose Mode)

Module popup dédié (`compose.html`, `compose.js`, `compose.css` + `mt-text.js`) s'exécutant lors du clic sur `compose_action` ou `Alt+Shift+M` dans la fenêtre de composition.

Responsabilités :
- Lecture et restauration du brouillon via `messenger.compose.getComposeDetails()` / `setComposeDetails()` (en passant exclusivement `plainTextBody` ou `body` selon `isPlainText`).
- Traduction chirurgicale de la sélection active par tranches de `TextNode` (`extraireTranchesSelectionEditeur` / `injecterTranchesSelectionEditeur` + `MTText.decouperLong` et `extraireEspaces`) préservant intégralement la structure HTML (`<b>`, `<p>`, `<br>`).
- Regroupement atomique Objet + Corps en une seule passe via sentinelle `MTSEP` lorsque les deux portées sont cochées, et support de la langue d'alternance (`alternateTarget`).
- Stockage éphémère purement en mémoire vive (`browser.storage.session`, avec table `Map` interne en repli RAM — aucune écriture sur disque `storage.local`) d'un instantané incrémental et complet avant modification (y compris lors d'un élargissement de portée Objet ↔ Corps/Sélection) permettant une restauration 100 % déterministe en un clic.

### 2.4 `options/` — page de préférences

Page d'options intégrée (`options.html`, `options.js`, `options.css`) 100 % internationalisée en 7 langues : validation stricte des champs obligatoires (`aria-invalid`), garde Zéro-Clic exigeant au moins une langue en mode ciblé, politique *fail-closed* sur les permissions d'hôtes (`assurerPermissionsHote`), conservation des modèles Gemini dynamiques, et synchronisation Gemini déclenchée uniquement par action explicite ou au chargement si Gemini est actif.

### 2.5 `setup/` — assistant de premier lancement & consentement explicite (Opt-In)

Page d'accueil dédiée (`setup.html`, `setup.js`, `setup.css`) ouverte automatiquement à la première installation (`provider === "none"` et `!onboardingShown`) :
- Informe clairement l'utilisateur des données transmises avant tout appel réseau.
- Permet d'activer **Google Translate** en 1 clic avec case à cocher optionnelle (décochée par défaut) pour le relais de secours **MyMemory**, ou d'ouvrir la page complète des Options.
- Affiche et actualise dynamiquement l'état réel via `getConfig` + `storage.onChanged` lors d'une réouverture ultérieure.
- Si l'utilisateur ferme cet onglet sans faire de choix (`provider === "none"`), le **filet de sécurité inline** (`.mt-consent-bar` en lecture et `#consent-banner` en rédaction) s'affiche immédiatement dès l'ouverture du bandeau/popup (bouton Traduire désactivé tant que le consentement n'est pas donné, case optionnelle MyMemory décochée par défaut) et lance directement la traduction après activation en 1 clic.

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
| injected / compose / options → background | `{ action: "ping" }` | `{ pong: true }` (maintien en éveil de l'Event Page MV3 lors des appels lents) |
| injected / compose → background | `{ action: "translate", text, source, target }` | `{ success: true, text, detectedLang, provider, providerLabel, providerNom, usedFallback }` ou `{ success: false, error }` (`CONSENT_REQUIRED`, `CLEARTEXT_FORBIDDEN`, `SERVICE_UNAVAILABLE`, etc.) |

### Hub Multi-Fournisseurs (`mt-providers.js`)

- **Timeouts différenciés** : `TIMEOUT_CLOUD_MS = 10000` (10 s) pour les services Cloud ; `TIMEOUT_LOCAL_MS = 60000` (60 s) pour LibreTranslate et les moteurs locaux (Ollama, LM Studio, serveurs personnalisés).
- **Politique *fail-closed* stricte** :
  - `obtenirFournisseur("none")` ou identifiant inconnu retourne `null` ; `traduireAvecFournisseur()` lève `CONSENT_REQUIRED` sans émettre la moindre requête réseau.
  - `obtenirPatternOrigine()` retourne `""` sur URL invalide ou HTTP hors loopback ; `FournisseurLibreTranslate` et `FournisseurOpenAICompatible` refusent les URLs vides (`INVALID_PAYLOAD` / `INVALID_URL`).
- **Parité 1:1 HTTPS & Loopback (`estHoteLoopback` & `validerUrlSecurisee`)** :
  - Les URLs `https://` sont autorisées partout (avec `optional_host_permissions: ["https://*/*"]`).
  - Les URLs `http://` sont strictement restreintes à `localhost` et `127.0.0.1` sans identifiants imbriqués, en parité exacte avec `host_permissions` et la directive CSP `connect-src https: http://localhost:* http://127.0.0.1:*` de `manifest.json`. Toute adresse LAN ou distante en `http://` lève `CLEARTEXT_FORBIDDEN`. Aucune clé d'API n'est jamais transmise sur `http://`.
- **Découpage UTF-8 en octets (`decouperParOctetsUtf8`)** :
  - **Google Translate (`google`)** : `GET https://translate-pa.googleapis.com/v1/translate?key=<PUBLIC_CLIENT_KEY>&params.client=gtx&...`, sous-découpé par octets UTF-8 (`<= 1800` octets avant encodage URL, en respectant les frontières `MTSEP`) pour prévenir toute erreur HTTP 414 sur les textes CJK/cyrilliques/arabes. Relais optionnel vers MyMemory uniquement si `enableMyMemoryFallback === true` et autorisé par `permissions.contains` (désactivé lors de `testerConnexion`), en remontant `effectiveProvider: "mymemory"` et `usedFallback: true`.
  - **MyMemory (`mymemory`)** : `GET https://api.mymemory.translated.net/get`, sous-découpé par octets UTF-8 (`<= 450` octets), isolant les jetons `MTSEP` pour ne jamais les envoyer sur le réseau et décodant les entités HTML retournées (`&apos;`, `&#39;`, `&nbsp;`, etc.).
  - **Google Gemini (`gemini`) & Hub LLMs (`llm`)** : encapsulation du message dans une balise à nonce aléatoire `<source_text_<16hex>>...</source_text_<16hex>>` vérifiée absente du message, filtrage des parts `thought` Gemini, et nettoyage symétrique dans `nettoyerReponseLLM`.

---

## 4. Cycle de vie, Accessibilité & Sécurité DOM

- **État isolé par instance (`_mtSeq`)** : dans `translator-injected.js`, l'ensemble de l'état et des timers (`timersInstance`) vit dans la portée de chaque instance, protégé des doubles injections (`_mtBodyBound` + `MutationObserver` débouncé 50 ms) et intégralement annulé par `nettoyerInstance()` lors du passage rapide d'un e-mail à un autre.
- **Collecte DOM exhaustive** : `collecterNoeudsTexte` et `extraireTextePourDetection` remontent toute la chaîne d'ancêtres jusqu'à `racine` pour exclure `SCRIPT`, `STYLE`, `NOSCRIPT`, `TEMPLATE`, `CODE`, ainsi que tout ancêtre `[hidden]`, `[aria-hidden="true"]` ou masqué par CSS calculé (`getComputedStyle` : `display: none`, `visibility: hidden/collapse`, `opacity: 0`, `font-size: 0`).
- **Accessibilité WCAG 2.1 AA** :
  - Contrastes vérifiés `>= 4.5:1` sur tous les boutons primaires (`#6d28d9` / `#4f46e5`), bandeaux glassmorphism (`rgba(15, 23, 42, 0.93)` et thème clair), interrupteurs `role="switch"` en thème clair et sombre, et contours `:focus-visible`.
  - Régions `role="status" aria-live="polite"` maintenues dans l'arbre ARIA (y compris hors du bandeau replié dans le Shadow DOM), absence de vol de focus en Mode Zéro-Clic, et restitution du focus clavier à la fermeture par `Escape` ou repli.
- **Sécurité DOM stricte** : zéro `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval` ou `new Function`. Manipulation exclusive via `textContent`, `createTextNode` et `DOMParser`.
