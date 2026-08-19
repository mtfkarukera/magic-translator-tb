# Changelog

Toutes les modifications notables de **Magic Translator** sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit le
[versionnage sémantique](https://semver.org/lang/fr/).

> Les entrées antérieures à 2.0.8 sont **reconstituées à partir de l'historique Git** (le projet ne
> tenait pas de changelog jusqu'ici) ; elles regroupent les changements par version telle que
> référencée dans les messages de commit.

## [2.3.4] — 2026-08-19

Détection proactive et autorisation 1-clic des permissions d'hôte WebExtension : élimination des échecs silencieux et synchronisation du statut de connexion réel.

### Ajouté
- **`mt-providers.js`** :
  - Ajout de la fonction pure `obtenirPatternOrigine(provider, config)` calculant dynamiquement le pattern d'hôte requis pour chaque moteur (Google, DeepL Free/Pro, Gemini, LLMs Cloud/Locaux, LibreTranslate).
- **`background.js` (Vérification et Demande Réelle de Permission)** :
  - **`getConfig` enrichi** : Vérifie l'état réel de permission via `messenger.permissions.contains()` et renvoie `hasPermission` et `requiredOrigin`.
  - **Action `requestPermission`** : Point d'entrée sécurisé pour déclencher `messenger.permissions.request()` sous geste utilisateur.
  - **Protection `translate`** : Guard préventif renvoyant le code d'erreur `PERMISSION_REQUIRED` au lieu d'une erreur réseau générique si la permission est manquante.
- **`translator-injected.js` (Bandeau de Lecture)** :
  - **Voyant d'alerte orange (`●`)** : Passe le badge en `.is-warning` si la permission hôte n'est pas accordée par Thunderbird.
  - **Autorisation 1-Clic Transparente** : Un simple clic sur le badge ou sur *Traduire* déclenche la demande native Thunderbird, repasse le statut au vert et poursuit la traduction sans rechargement.
  - **Gestion i18n de `PERMISSION_REQUIRED`** : Message explicite dans les 7 langues supportées.
- **`compose/compose.js` & `compose/compose.css` (Popup Rédaction)** :
  - Intégration du voyant d'alerte `.provider-dot.is-warning` et de l'autorisation 1-clic préventive avant traduction.
- **`_locales/`** :
  - Ajout de la clé `composeStatusPermissionRequired` dans l'ensemble des 7 langues.

## [2.3.3] — 2026-08-18

Harmonisation ergonomique : badge moteur interactif dans le bandeau de lecture avec statut de connexion et accès direct aux préférences.

### Ajouté
- **`translator-injected.js` (Bandeau de Lecture)** :
  - **Badge Moteur Interactif** : Transformation du badge texte en bouton capsule interactif `[ ● Google ⚙️ ]` / `[ ● DeepL ⚙️ ]` / `[ ● Mistral AI ⚙️ ]`.
  - **Indicateur de statut vert (`●`)** : Visualisation instantanée de l'état prêt et connecté du moteur actif.
  - **Accès direct aux Préférences** : Un clic sur le badge ouvre immédiatement l'onglet des paramètres de l'extension.
  - **Accessibilité & WCAG AA** : Balise `<button type="button">`, infobulle explicite et contour `:focus-visible` calibré.
- **`background.js`** :
  - Ajout du gestionnaire de message `openOptions` pour une ouverture 100% résiliente des paramètres.

## [2.3.2] — 2026-08-18

Correctifs post-audit de code : accessibilité clavier WCAG AA, verrouillage anti-concurrence, normalisation BCP-47 / LLM Hub et hardening DOM.

### Corrigé
- **`compose/compose.css` (Accessibilité WCAG 2.1 AA)** :
  - **Navigation Clavier** : Remplacement de `display: none` sur les cases à cocher par un masquage accessible (`position: absolute; opacity: 0;`), permettant le focus et l'activation des toggles (Objet / Corps / Sélection) au clavier via la touche `Espace`.
  - **Focus Visible** : Ajout de règles `:focus-visible` avec anneaux contrastés sur les toggles, boutons d'action et badges.
  - **Contrastes en thème clair** : Ajustement de `--status-busy` (`#b45309`, ratio 5.1:1 sur blanc) et de `.magic-softs-link` pour respecter le seuil minimal de 4.5:1.
  - **Respect de `prefers-reduced-motion`** : Neutralisation de l'animation `pulse` et des transitions.
- **`translator-injected.js` (Robustesse & Accessibilité)** :
  - **Verrouillage Anti-Concurrence** : Ajout d'un verrou booléen `traductionEnCours` et désactivation explicite des boutons `btnTraduire` et `btnOriginal` (`disabled = true`) pendant la requête réseau pour éliminer tout risque de double-clic ou de perte de l'état initial.
  - **Nettoyage ARIA** : Suppression systématique de `aria-busy` et `aria-disabled` dans le bloc `finally`.
- **`background.js` (Robustesse & Gestion Réseau)** :
  - **Assouplissement BCP-47** : Passage de `CODE_LANGUE_RE` en insensible à la casse (`/i`) pour accepter les sous-étiquettes régionales minuscules (`pt-br`, `zh-cn`).
  - **Nettoyage du stockage** : Purge proactive au démarrage des clés temporaires de rédaction orphelines `compose_orig_*`.
- **`mt-providers.js` (Robustesse LLM Hub)** :
  - **Normalisation des endpoints LLM** : Ajout du helper `construireEndpointLLM` évitant les doubles `/v1` si l'utilisateur saisit déjà `/v1` comme base URL.
- **`options/` (Sécurité & Accessibilité)** :
  - `options/options.js` : Remplacement d'un `innerHTML = ""` résiduel par `replaceChildren()`.
  - `options/options.html` : Ajout de l'attribut `lang="fr"` sur `<html>`.
  - `options/options.css` : Ajout des indicateurs `:focus-visible` et support de `prefers-reduced-motion`.

## [2.3.1] — 2026-08-18

Épure du bandeau de lecture, repli manuel exclusif et correctifs de contraste en thème clair.

### Modifié
- **`translator-injected.js`** :
  - **Épure du bandeau** : Suppression des libellés textuels redondants « DE » et « VERS » pour un flux épuré `[MT] Google | [ Auto-détection ▾ ] → [ Français ▾ ]`.
  - **Accessibilité (a11y)** : Maintien et renforcement des attributs `aria-label` sur chaque sélecteur pour les lecteurs d'écran.
  - **Repli manuel exclusif** : Suppression du timer asynchrone de repli automatique. Le bandeau reste désormais ouvert et stable après traduction, laissant les boutons « Retraduire » et « Original » directement accessibles.
  - **Correction contraste & Focus en thème clair** : Suppression du fond sombre hardcodé sur `:focus`, ajout de tokens de thème dynamiques (`--mt-bg-input`, `--mt-bg-input-focus`, `--mt-option-bg`) et déclaration de `color-scheme: light dark;`.
  - **Suppression du label "Translator"** dans le logo pour un en-tête ultra-compact.
- **`options/options.html` & `options/options.css`** :
  - Épure du pied de page avec lien interactif discret vers la suite logicielle `magic-softs` (`https://magic-clipper.mtfk.fr/`).

## [2.3.0] — 2026-08-18

Mode Rédaction (*Compose Mode*) : Traduction in situ, multilingue et réversible dans la fenêtre de composition d'e-mails.

### Ajouté
- **`compose/` (Nouveau module)** :
  - `compose/compose.html` : Interface popup dédiée à la fenêtre de composition avec sélection de langues, périmètres (Objet / Corps / Sélection), boutons d'action et feedback dynamique.
  - `compose/compose.css` : Design **Glassmorphism** adaptatif (`backdrop-filter: blur(16px)`), prise en charge native des thèmes clair et sombre (`color-scheme: light dark`), conformité WCAG AA et micro-animations fluides.
  - `compose/compose.js` : Logique d'interaction avec l'API officielle `messenger.compose` (`getComposeDetails` / `setComposeDetails`), traduction in situ réversible sans pollution DOM, détection intelligente de la sélection de texte et restauration en un clic.
- **`manifest.json`** :
  - Déclaration de `"compose_action"` avec icône et popup dédié.
  - Ajout de la permission officielle `"compose"`.
  - Déclaration du raccourci clavier `_execute_compose_action` (`Alt+Shift+T`).
- **`_locales/{en,fr,de,es,ja,pt,vi}/messages.json`** : Ajout de 21 nouvelles clés de localisation pour le mode rédaction dans les 7 langues officielles.
- **`background.js`** : Ajout d'une entrée de menu contextuel sur l'action de composition pour ouvrir les préférences.
- **`build.sh`** : Inclusion automatique du dossier `compose/` dans le packaging XPI.

## [2.2.4] — 2026-08-18

Internationalisation intégrale de la page de préférences (7 langues).

### Ajouté
- **`options/options.html` & `options/options.js`** : Support multilingue complet via le moteur `appliquerI18n()` et l'API native `browser.i18n.getMessage()`.
- **`_locales/{en,fr,de,es,ja,pt,vi}/messages.json`** : Ajout de l'intégralité des clés de traduction de l'interface des options (titres, sélecteurs, champs de saisie, aides textuelles, messages de statut et tooltips) pour les 7 langues officielles de l'extension.

## [2.2.3] — 2026-08-18

Correctif de dimensionnement de la page d'options (boucle infinie de scroll).

### Corrigé
- **`options/options.css`** : Suppression de `min-height: 100vh;` sur `html, body` qui déclenchait une boucle de redimensionnement infini de l'iframe dans le gestionnaire de modules de Thunderbird.

## [2.2.2] — 2026-08-18

Épuration visuelle & Correction du thème sombre des options.

### Modifié
- **`translator-injected.js`** : Suppression complète de la pilule flottante résiduelle `mt-pill`. Le bandeau se referme proprement sans laisser d'élément flottant masquant le texte des e-mails. L'ouverture et la fermeture sont pilotées directement par le bouton `[Traduire]` de la barre de message, le menu ou le raccourci `Alt+Shift+T`.
- **`options/options.css`** : Ajout de la directive standard `color-scheme: light dark;` sur `:root` et harmonisation des fonds avec les couleurs natives de Thunderbird (`#2b2a33`, `#1c1b22`), éliminant tout cadre blanc disgracieux en mode sombre.

## [2.2.1] — 2026-08-17

Correctif de conformité Mozilla Add-ons (ATN).

### Modifié
- **`background.js`** : Refactorisation de l'écouteur `runtime.onMessage` en écouteur synchrone officiel retournant `true` et répondant via `sendResponse()` conformément aux guides d'API Thunderbird MV3.

## [2.2.0] — 2026-08-17

Sprint 2 — Hub LLMs Cloud (Google Gemini API, OpenAI, Groq, Mistral) & LLMs Locaux (Ollama, LM Studio).

### Ajouté
- **Google Gemini API Dédiée (`FournisseurGemini`)** :
  - Support natif de l'API REST Google AI Studio (`generativelanguage.googleapis.com`).
  - Modèle ultra-rapide et économique `gemini-2.0-flash` par défaut, avec support des variantes `gemini-1.5-flash` et `gemini-1.5-pro`.
- **Hub LLMs OpenAI-Compatible (`FournisseurOpenAICompatible`)** :
  - Adaptateur universel standardisé `/v1/chat/completions`.
  - Presets en un clic avec pré-remplissage intelligent :
    - **OpenAI** (`https://api.openai.com`, modèle `gpt-4o-mini`)
    - **Groq Cloud** (`https://api.groq.com/openai`, modèle `llama-3.3-70b-versatile`)
    - **Mistral AI** (`https://api.mistral.ai`, modèle `mistral-small-latest`)
    - **Ollama (Local)** (`http://localhost:11434`, modèle `llama3.2`, sans clé requise)
    - **LM Studio (Local)** (`http://localhost:1234`, modèle `local-model`, sans clé requise)
    - **Serveur Personnalisé** (vLLM, Text-Generation-WebUI, etc.)
  - Prompting système étanche imposant un retour strictement brut du texte traduit.
  - Fonction de nettoyage `nettoyerReponseLLM` pour supprimer les éventuels encadrements markdown et guillemets parasites.
- **Interface d'Options Étendue (`options/options.html`, `.js`)** :
  - Deux nouvelles sections dédiées (*Google Gemini API* et *Hub LLMs*).
  - Gestion du pré-remplissage dynamique d'URL et de modèle lors du choix d'un preset.
  - Demande automatique des permissions d'hôte pour tous les nouveaux endpoints Cloud et locaux.
- **Tests Unitaires Étendus (`test/providers.test.js`)** :
  - 17 tests unitaires couvrant la résolution des noms de langues, le nettoyage des réponses LLM, et les flux Gemini / OpenAI-compatible.

### Modifié
- **`manifest.json`** : Ajout des permissions d'hôtes pour `generativelanguage.googleapis.com`, `api.openai.com`, `api.groq.com`, et `api.mistral.ai`.
- **`background.js`** : Extension de `CONFIG_DEFAUT` et acheminement dynamique des clés, modèles et endpoints vers `MTProviders`.

---

## [2.1.0] — 2026-08-17

Sprint 1 — Socle Multi-Fournisseurs (Google Translate, DeepL API, LibreTranslate), Page d'Options dédiée & Badge Moteur.

### Ajouté
- **Module Multi-Fournisseurs (`mt-providers.js`)** :
  - **Google Translate** : Moteur par défaut, gratuit, sans configuration.
  - **DeepL API** : Support complet des plans Free (`api-free.deepl.com`) et Pro (`api.deepl.com`) avec normalisation automatique des codes cibles BCP-47 (`EN-US`, `PT-PT`, `PT-BR`, `ZH-HANS`).
  - **LibreTranslate** : Support des instances ouvertes et des serveurs locaux/auto-hébergés avec clé d'API optionnelle.
- **Page d'Options (`options/options.html`, `.css`, `.js`)** :
  - Interface soignée en *Dark Glassmorphism* respectant les normes WCAG AA.
  - Formulaire dynamique s'adaptant au moteur sélectionné.
  - Bouton de **test de connexion en direct** pour valider immédiatement ses clés d'API.
  - Persistance sécurisée dans `browser.storage.local`.
- **Badge Moteur Visuel** :
  - Badge discret (`.mt-engine-badge`) affiché sur le bandeau de traduction pour identifier le moteur actif en un coup d'œil.
- **Menu Contextuel Avancé** :
  - Nouvelle entrée « Options / Paramètres » au clic droit sur le bouton de barre de message.
- **Tests Unitaires (`test/providers.test.js`)** :
  - Suite de tests `node:test` validant le mapping des langues DeepL, la détection Free/Pro, l'authentification et le fallback automatique.

### Modifié
- **`manifest.json`** : Ajout de la permission `storage`, déclaration de `options_ui`, et ajout des `host_permissions` nécessaires.
- **`build.sh`** : Inclusion de `mt-providers.js` et du dossier `options/` dans l'archive `.xpi` de distribution.

### Corrigé
- **Positionnement de la pilule (`translator-injected.js`)** : Passage en `position: absolute` pour éliminer l'espace blanc de 34 px qui décalait l'e-mail vers le bas en mode replié.
- **Thème adaptatif des options (`options.css`)** : Support automatique du thème clair et du thème sombre de Thunderbird avec fond transparent pour une intégration native parfaite.
- **Gestion dynamique des permissions (`options.js`)** : Demande d'autorisation d'hôte à la volée (`browser.permissions.request`) lors du test ou de l'enregistrement pour éviter les blocages de sécurité en mode développement.

---

## [2.0.17] — 2026-06-30

Sprint d'audit complet (Sécurité · Robustesse · Accessibilité · Design) — 24 corrections appliquées.

### Sécurité
- **[M-S1] Validation de l'expéditeur** : `messenger.runtime.onMessage` vérifie désormais que `expediteur.id === messenger.runtime.id` — rejette tout message venant de l'extérieur de l'extension.
- **[M-S2] Validation BCP-47** : Les codes de langue sont validés par regex `CODE_LANGUE_RE` avant d'être injectés dans l'URL Google Translate — élimine le risque d'injection de paramètre URL.
- **[Mi-S1] Normalisation des erreurs** : Le background ne propage plus jamais de message JavaScript brut à l'UI — seuls les codes connus (`CODES_ERREURS_CONNUS`) sont retournés, le reste est normalisé en `SERVICE_UNAVAILABLE`.
- **[Mi-S3] Entropie SENTINEL** : Le jeton anti-collision est désormais généré via `crypto.getRandomValues()` (CSPRNG) au lieu de `Math.random()`.
- **[Mi-R1] Guard traduction vide** : Si Google Translate retourne une traduction vide (contenu null), une erreur `SERVICE_UNAVAILABLE` est levée plutôt que de vider silencieusement le texte de l'e-mail.

### Corrigé (Robustesse)
- **[M-R1] Double nettoyerInstance supprimé** : L'appel redondant à l'initialisation du module créait des race conditions en cas de récursion MutationObserver.
- **[M-R2] Guard instanceId en boucle** : Vérification de `_mtActiveInstanceId` à chaque itération de lot ET de segment long — stoppe immédiatement si l'utilisateur a changé d'e-mail.
- **[M-R3] Guard `contenusOriginaux` dans fallback** : Protège le fallback nœud-par-nœud contre une remise à null de `contenusOriginaux` entre deux `await` successifs.
- **[M-R4] Annulation repliAuto avant MutationObserver reinit** : Évite que le timer de repli automatique déclenche `replier()` sur une instance déjà nettoyée.
- **[M-R5] Suppression `.trim()` sur nœud unique long** : Préserve les `\n` de tête/fin dans les e-mails texte brut (`<pre>`).
- **[Mi-R2] Guard `document.body`** : Vérification explicite avant d'appeler `collecterNoeudsTexte()` si Thunderbird n'a pas fini de charger.
- **[Mi-R3] Erreur structurée sendMessage** : `demanderTraduction` lance `SERVICE_UNAVAILABLE` si la réponse est `undefined` (listener sans `return Promise`).
- **[I-R1] Timeout réduit + constante nommée** : `TIMEOUT_TRADUCTION_MS = 10000` (depuis 15 s).

### Corrigé (Accessibilité WCAG 2.1 AA)
- **[B-A1] Focus visible** : `outline:none` brut remplacé par `outline:0` sur `.mt-btn` et `.mt-select` ; indicateur visible ajouté via `:focus-visible` uniquement (navigation clavier).
- **[B-A2] Spinner décoratif** : `aria-hidden="true"` sur le spinner de chargement pour éviter la double annonce sonore.
- **[B-A3] Bouton Traduire aria-busy** : `aria-busy="true"` + `aria-disabled="true"` pendant la traduction (WCAG 4.1.3).
- **[B-A4] Pilule `<button>` natif** : La pilule passe de `<div role="button">` à un vrai `<button type="button">`. Touche Escape dans le bandeau replie sans JS supplémentaire.
- **[M-A1] logoIcone purement décoratif** : Suppression du rôle bouton (doublon avec `btnReplier`) → `aria-hidden="true"`.
- **[M-A2] Contraste `--mt-text-secondary`** : `#b0bec5` (≥4.5:1) au lieu de `#94a3b8` (~3.8:1).
- **[M-A3] `aria-expanded` sur pilule** : Mis à jour à chaque appel de `deplier()`/`replier()`.
- **[M-A4] Zone aria-live toujours dans l'arbre ARIA** : Masquage par `visibility:hidden` (au lieu de `display:none`) pour que NVDA/JAWS détecte les mutations.
- **[M-A5] Icône ⚠ avec `aria-hidden`** : L'icône est dans un `<span aria-hidden>` séparé du texte.
- **[Mi-A1] Attribut `lang` sur le conteneur** : Permet aux lecteurs d'écran de prononcer l'UI dans la bonne langue.

### Modifié (Design & UX)
- **[B-D1] Suppression `white-space:nowrap` sur `.mt-status`** : Évite le débordement en fenêtre étroite.
- **[M-D1] `prefers-reduced-motion`** : Animations désactivées (spinner statique, transitions supprimées).
- **[M-D2] Responsive** : Media query `@media (max-width: 480px)` — contrôles en colonne, sélecteurs pleine largeur.
- **[M-D3] Mode clair `prefers-color-scheme: light`** : Variables CSS retournées pour thèmes clairs Thunderbird.
- **[Mi-D1] `transition` ciblée** : Remplacement de `transition: all` par des propriétés spécifiques sur `.mt-btn`, `.mt-select`, `.mt-pill`, `.mt-btn-collapse`.
- **[Mi-D3] Tokens CSS consolidés** : Ajout de `--mt-bg-pill-hover`, `--mt-accent-purple-dim`, `--mt-divider`, `--mt-btn-secondary-bg/border` — élimination des valeurs codées en dur.
- **[Mi-D4] Zone de clic pilule agrandie** : `min-height: 32px` + padding augmenté.
- **[Mi-D5] Pilule hover corrigé** : `translateY(-1px)` (montée) au lieu de `(+1px)` (enfoncement).

---

## [2.0.16] — 2026-06-29

Correctif de robustesse pour résoudre le bug d'affichage aléatoire (bouton inactif).

### Corrigé
- **Bouton inactif (perte de liaison)** : Implémentation d'une injection manuelle de secours dans `background.js` (si le script de contenu ne répond pas, il est réinjecté à la volée avant de transmettre l'action).
- **Remplacement du body par Thunderbird** : Doublement du `MutationObserver` dans `translator-injected.js` pour observer à la fois `document.body` (mutations internes) et `document.documentElement` (remplacement complet du body), sans impact sur les performances (pas de `subtree: true`).

---

## [2.0.15] — 2026-06-29

Améliorations de robustesse, accessibilité (WCAG 2.1 AA) et refonte esthétique premium.

### Ajouté
- **Landmark sémantique** : Le bandeau principal utilise désormais `role="region" aria-label="Translator"`.
- **Labels accessibles** : Utilisation de balises `<label>` pour les sélecteurs de langues liés par identifiant unique (`mt-select-source`, `mt-select-cible`).
- **Aria-label** : Bouton de repli explicitement labellisé `aria-label="Replier"`.

### Corrigé
- **Ruptures de focus clavier (WCAG 2.4.3)** : Transfert automatique du focus vers le sélecteur de langue à l'ouverture, et retour fluide du focus sur la pilule à la fermeture.
- **Race Condition inter-messages** : Ajout d'un identifiant d'instance unique pour bloquer les écritures asynchrones de traduction d'anciens e-mails lors de changements rapides.
- **Fuites de mémoire** : Nettoyage du timer de repli automatique dans la fonction `nettoyerInstance()`.
- **Boucle infinie** : Garde-fou dans `decouperLong` si `maxLen <= 0`.
- **Limitation d'appels** : Interruption immédiate du fallback de traduction nœud-par-nœud si une erreur `RATE_LIMITED` ou `NETWORK` est rencontrée.

### Modifié
- **Design Premium** : Refonte esthétique avec Glassmorphism (`backdrop-filter`), utilisation de tokens de design CSS et courbes d'animation cubic-bezier. Contrastes améliorés pour le logo et le bouton repli.
- **Maintenance** : Suppression du warning obsolète lié à `localhost:9999` dans `build.sh`.

---

## [2.0.14] — 2026-06-14

Qualité & dette technique — **Lot 5** de l'audit (dernier lot).

### Ajouté
- **Tests unitaires** (`test/text.test.js`, `node:test`, zéro dépendance) sur les helpers de texte
  purs, extraits dans **`mt-text.js`** (`decouperLong`, `extraireEspaces`) — filet anti-régression
  sur le découpage des gros nœuds et la préservation des espaces (les parties qui avaient eu des
  bugs). Lancer avec `npm test` ; intégré au rituel de fin de sprint.

### Corrigé
- **Nom de langue marathi** corrompu (`mr`) : mélange arabe/cyrillique/devanagari → `"मराठी"`.
  Validation Unicode passée sur toute la table `NOMS_LANGUES` (53 entrées, aucun autre mélange).
- Commentaire de détection de locale et repli `navigator.language` : « fr » → « en » (cohérent avec
  le fallback réel).

### Modifié
- **Déduplication** des données de langues : `LANGUES` (sélecteurs) est désormais **dérivée** de
  `NOMS_LANGUES` (source unique code→nom) — fin de la double maintenance des libellés.
- **Enregistrement du script de contenu** plus robuste : désenregistrement puis réenregistrement,
  pour que la liste de fichiers à jour (dont `mt-text.js`) s'applique aussi lors d'une mise à jour.

---

## [2.0.13] — 2026-06-14

UX & accessibilité — **Lot 4** de l'audit.

### Ajouté
- **Raccourci clavier remappable** : déclaré via la clé `commands` du manifest (défaut
  **Alt+Shift+T**), visible et reconfigurable dans les paramètres de Thunderbird, **sans collision**
  avec « rouvrir l'onglet » (`Ctrl+Shift+T`).
- **Accessibilité clavier** : la pilule et le logo (cliquables) sont désormais des boutons focusables,
  activables avec Entrée/Espace ; focus visible rétabli (`:focus-visible`).
- **Lecteurs d'écran** : la zone de statut est une région `aria-live` (annoncée) ; les boutons-icônes
  ont un `aria-label` ; les éléments décoratifs (chevron, flèche) sont `aria-hidden`.
- **Icône d'avertissement** sur les erreurs (« ⚠ ») — l'information n'est plus véhiculée par la seule
  couleur.
- **« Déjà en {langue} »** : en auto-détection, si la langue détectée est déjà la cible, le statut le
  signale au lieu de « Traduit depuis… » (qui laissait croire à une traduction).

### Modifié
- **Repli automatique respectueux** : le timer de 1,5 s est suspendu tant que la souris survole le
  bandeau ou que le focus y est, puis reprogrammé à la sortie (ne fait plus disparaître le contexte).
- **Cible par défaut** : prend en compte les locales régionales (ex. `zh-CN`) si présentes dans la
  liste, avant de retomber sur le code primaire puis `en`.
- Le raccourci affiche / masque le traducteur (comportement unifié avec le bouton de la barre).

### Supprimé
- Écouteur `keydown` `Ctrl+Shift+T` du script de contenu et l'`AbortController` associé (remplacés
  par la clé `commands`).

---

## [2.0.12] — 2026-06-14

Robustesse — **Lot 3** de l'audit.

### Ajouté
- **Écriture atomique de la traduction** : les traductions de tous les lots sont accumulées puis
  appliquées au DOM en une seule fois. Si un lot échoue (réseau/service), **rien n'est écrit** —
  l'e-mail ne reste jamais « à moitié traduit ».
- **Découpage des nœuds > 4000 caractères** : un nœud trop long est sous-découpé en segments traduits
  séparément puis recollés, au lieu d'être tronqué silencieusement par Google.
- **Indicateur de progression** « Traduction… (i/N) » pour les e-mails en plusieurs lots.
- **Messages d'erreur clairs et localisés** (7 langues) : trop de requêtes (429), service
  indisponible (5xx / réponse HTML-captcha / JSON invalide), délai dépassé, erreur réseau.
- Statut **« ⚠ Traduit partiellement »** si un nœud échoue dans le fallback (le bandeau reste ouvert).

### Sécurité
- **Validation du payload** entrant dans le gestionnaire `onMessage` du background (rejet si
  `text`/`source`/`target` ne sont pas des chaînes).

### Modifié
- `background.js` : gestion des erreurs réseau/HTTP refondue (codes `RATE_LIMITED`,
  `SERVICE_UNAVAILABLE`, `TIMEOUT`, `NETWORK`) + vérification du parsing JSON avant usage.
- Docs : `ARCHITECTURE.md` (écriture atomique, gros nœuds, gestion d'erreurs) ; en-tête de
  `background.js` corrigé (suppression de la mention obsolète au stockage de locale).

---

## [2.0.11] — 2026-06-13

### Corrigé
- **« Texte collé » autour des liens** — correctif **complet** (celui de 2.0.10 était incomplet : la
  regex de découpage mangeait l'espace de fin du texte précédant un lien). L'espacement aux
  frontières de nœuds est désormais **entièrement préservé** : chaque nœud est découpé en
  `[espace de tête][cœur][espace de fin]`, seul le **cœur** (sans espaces de bord) est envoyé à
  Google, et les espaces d'origine sont **réattachés** à la réinjection. L'espacement ne dépend donc
  plus de ce que Google fait des blancs ni de la regex (ex. « à l'adresse » garde son espace avant un
  lien ; les sauts de paragraphe `\n\n` sont conservés). S'applique aussi au fallback nœud-par-nœud.

---

## [2.0.10] — 2026-06-13

### Sécurité
- **Déclaration de collecte de données corrigée** (`manifest.json`) — Lot 2 de l'audit.
  `data_collection_permissions.required` passe de `["none"]` à **`["personalCommunications"]`** :
  le contenu des messages est transmis à un tiers (Google), `["none"]` était donc inexact.
- **Séparateur de découpage fiabilisé** (`translator-injected.js`) — Lot 2. Remplacement des
  marqueurs `@@N@@` par un jeton alphanumérique long et aléatoire (`MTSEP…`). La détection de
  collision et le découpage utilisent désormais **le même jeton** : suppression du contournement
  par espacement interne (`@@ 0 @@`) et du risque de ReDoS (plus de `\s*` non borné).

### Corrigé
- **« Texte collé »** sur les e-mails en texte brut : la regex de découpage n'avale plus les retours
  à la ligne légitimes adjacents au séparateur (elle ne retire que le jeton + au plus un saut de
  ligne de chaque côté). Les sauts de paragraphe autour des liens sont préservés.

### Documentation
- README + `SECURITY.md` : flux de données précisé — seul le **corps rendu** du message est transmis
  à Google ; les en-têtes Thunderbird (de/à/sujet) ne sont pas collectés (Lot 2, volet « en-têtes »
  résolu par documentation : le document de contenu ne contient pas le bloc d'en-têtes).

---

## [2.0.9] — 2026-06-13

### Sécurité
- **Retrait complet du harnais de débogage `remoteLog` / `DEBUG`** des deux scripts
  (`background.js` et `translator-injected.js`) — résout le **Lot 1** de l'audit de confidentialité.
  Ce mécanisme, lorsqu'il était activé (`DEBUG = true`), envoyait le contenu des e-mails (texte
  original, traduit, objet message complet) en HTTP non chiffré vers `http://localhost:9999`. Il
  n'existe plus ; le débogage passe par `console.log` local. Garde-fous conservés : `build.sh`
  refuse de packager si `DEBUG = true`, et `/revue-securite-pre-release` vérifie l'absence de
  `DEBUG`/`localhost`.
- **Moindre privilège** : retrait de la permission `storage` du manifest (plus aucun usage depuis le
  retrait du stockage de la locale UI) — Lot 2 de l'audit.

### Supprimé
- Une vingtaine d'appels `remoteLog({...})` et les deux définitions `const DEBUG` /
  `function remoteLog` (background + injected).
- Permission `storage` (`manifest.json`).

---

## [2.0.8] — 2026-06-13

### Ajouté
- Documentation projet : `ARCHITECTURE.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`
  (le rituel de fin de sprint est détaillé dans `CONTRIBUTING.md`).
- Script de packaging reproductible `build.sh` (sortie `dist/`, lien `magic-translator.xpi`) avec
  garde-fou refusant de packager si `DEBUG = true`.
- Scripts npm : `lint`, `lint:webext`, `build`.
- Skills Claude Code (`.claude/skills/`) : `fin-de-sprint`, `build-xpi`, `revue-securite-pre-release`.
- Entrée de menu i18n `toggleTranslatorTitle` (titre du menu clic-droit) dans les 7 locales.
- Timeout réseau `AbortSignal.timeout(15000)` sur la requête Google.

### Modifié
- `eslint.config.js` : `no-var` et `prefer-const` passés de `off` à `error`.
- Le titre du menu clic-droit est désormais localisé via `messenger.i18n.getMessage`.
- `.gitignore` durci : `*.log`, `build/`, `*.zip`, `.claude/settings.local.json` désormais ignorés
  (prévention de fuite de PII via `debug.log` et d'artefacts de build versionnés).

### Supprimé
- Mécanisme de stockage de la locale UI en `storage.local` (devenu inutile : la locale est détectée
  à la demande). La permission `storage` peut en conséquence être retirée (suivi dans `PLAN_ACTION.md`).
- `default_popup: null` superflu dans `message_display_action` du manifest.
- Fonction morte `estContexteValide()` (jamais appelée — supprimée pour atteindre 0 warning ESLint).

### Sécurité
- Le menu clic-droit `menus.create` est précédé d'un `menus.remove` pour éviter l'erreur
  « menu id already exists » au rechargement.
- ⚠️ **Connu, non résolu** : le harnais de débogage `remoteLog`/`DEBUG` (POST du contenu d'e-mails
  vers `http://localhost:9999`) reste présent mais **désactivé** (`DEBUG = false`). Son retrait
  complet est planifié (voir `SECURITY.md` et `PLAN_ACTION.md`, Lot 1).

---

## [2.0.7] — 2026-06-07

### Ajouté
- Locales d'interface **japonais (ja)** et **portugais (pt)**.
- Pilule à icône « MT », bouton de repli circulaire (▴), titre du bouton de barre localisé.

### Corrigé
- Fallback i18n `fr → en` pour les langues Thunderbird non supportées.

---

## [2.0.5] — 2026-06-07

### Modifié
- Améliorations UX du bouton de barre : titre, logo MT cliquable (referme le bandeau), bouton de
  repli agrandi.

---

## [2.0.4] — 2026-06-07

### Modifié
- À la désactivation, le bouton bascule masque l'ensemble de l'interface (bandeau + pilule).

---

## [2.0.3] — 2026-06-07

### Ajouté
- Bouton dédié dans la barre de message (`message_display_action`).

### Corrigé
- Séparateur de découpage `@@MTBRK@@` fiabilisé.

---

## [2.0.1] — 2026-06-07

### Corrigé
- Résolution de 6 bugs empêchant l'extension de fonctionner d'un message à l'autre.
- `onMessage` : retour `undefined` (et non `false`) dans l'écouteur, pour une réponse asynchrone
  correcte.

### Ajouté
- Documentation d'installation en production et comportement du raccourci clavier.

---

## [2.0.0] — 2026-06-03

### Ajouté
- Renommage de l'extension en **Magic Translator** ; auteur MTF Karukera.
- Configuration ESLint (flat config) — 0 erreur, 0 warning.
- Déclaration `data_collection_permissions` (politique « aucune collecte » côté manifest).
- Licence **MPL-2.0** et énoncé de confidentialité.

---

[2.0.14]: #2014--2026-06-14
[2.0.13]: #2013--2026-06-14
[2.0.12]: #2012--2026-06-14
[2.0.11]: #2011--2026-06-13
[2.0.10]: #2010--2026-06-13
[2.0.9]: #209--2026-06-13
[2.0.8]: #208--2026-06-13
[2.0.7]: #207--2026-06-07
[2.0.5]: #205--2026-06-07
[2.0.4]: #204--2026-06-07
[2.0.3]: #203--2026-06-07
[2.0.1]: #201--2026-06-07
[2.0.0]: #200--2026-06-03
