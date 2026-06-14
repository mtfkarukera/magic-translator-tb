# Architecture — Magic Translator

Document de référence sur le fonctionnement interne de l'extension. Pour les consignes de travail et
le rituel de fin de sprint, voir **`CONTRIBUTING.md`**.

---

## 1. Vue d'ensemble

Magic Translator est une **extension Thunderbird Manifest V3** qui traduit le contenu d'un e-mail
*in situ*, dans le panneau de lecture, de manière réversible. Elle se compose de **deux scripts** et
d'aucune dépendance runtime (pas de bundler, pas de framework, pas d'Experiment API).

```
┌─────────────────────────────────────────────────────────────────┐
│  Thunderbird                                                      │
│                                                                   │
│   ┌───────────────────────┐         ┌──────────────────────────┐ │
│   │  background.js         │         │  translator-injected.js  │ │
│   │  (contexte privilégié) │◄───────►│  (script de contenu,     │ │
│   │                        │ runtime │   DOM du message)        │ │
│   │  • registerScripts     │ message │                          │ │
│   │  • bouton + menu        │ passing │  • UI Shadow DOM         │ │
│   │  • proxy fetch Google  │         │  • collecte/réinjection  │ │
│   └───────────┬────────────┘         └──────────────────────────┘ │
│               │ fetch HTTPS                                        │
└───────────────┼───────────────────────────────────────────────────┘
                ▼
   translate.googleapis.com  (API Google Translate, client=gtx)
```

---

## 2. Les deux contextes d'exécution

### 2.1 `background.js` — contexte privilégié

S'exécute dans le processus principal de Thunderbird. Seul contexte autorisé à faire un `fetch`
cross-origin vers Google (déclaré dans `host_permissions`).

Responsabilités :

1. **Enregistrement du script de contenu** via `messenger.scripting.messageDisplay.registerScripts`
   (id `magic-translator-v2`). C'est ce qui injecte `translator-injected.js` dans chaque message
   affiché. *Cette API exige les permissions `scripting` ET `messagesRead`.*
2. **Bouton de barre de message** (`message_display_action`) : un clic envoie
   `{ action: "toggleBanner" }` à l'onglet courant.
3. **Menu clic-droit** sur ce bouton (Activer / Désactiver), via l'API `menus`. Le menu est
   `remove()` puis `create()` à chaque démarrage du background pour survivre aux rechargements.
4. **Proxy de traduction** : écoute `runtime.onMessage`, et sur `{ action: "translate" }`, appelle
   `traduireTexte()` qui interroge Google et renvoie `{ success, text, detectedLang }`.

### 2.2 `translator-injected.js` — script de contenu

IIFE injectée dans le document du panneau de lecture. **N'a PAS** accès à `browser.i18n` ni au
réseau cross-origin ; communique avec Google **uniquement** en passant par le background.

Responsabilités : construction de l'UI, détection de locale, collecte du texte, découpage/envoi,
réinjection, restauration, gestion du cycle de vie.

---

## 3. Flux de traduction détaillé

```
1. [Activation]  bouton barre / menu / raccourci (Alt+Shift+T, commands → background)
       → toggleBanner → le bandeau s'ouvre

2. [Collecte]    collecterNoeudsTexte(document.body)
       TreeWalker SHOW_TEXT, ignore SCRIPT/STYLE/CODE/… et les nœuds vides
       → tableau de nœuds Text

3. [Sauvegarde]  contenusOriginaux : Map<Text, string>
       (uniquement à la 1re traduction, pour la restauration)

4. [Découpage]   lots de ≤ 4000 caractères
       nœuds joints par un SÉPARATEUR unique "\n<SENTINEL>\n"
       SENTINEL = jeton alphanumérique long et aléatoire (vérifié absent du corps)

5. [Traduction]  pour chaque lot (statut « Traduction… (i/N) » si plusieurs lots) :
       runtime.sendMessage({action:"translate", text, source, target})
       → background fetch Google → texte traduit
       • nœud unique > 4000 car. : sous-découpé en segments, traduits puis recollés

6. [Réinjection ATOMIQUE]
       Traductions accumulées sans toucher au DOM, puis écrites toutes en fin de
       boucle. Si un lot échoue, RIEN n'est écrit → l'e-mail reste intact (jamais
       « à moitié traduit »).
       • lot mono-nœud  : cœur traduit + espaces d'origine réattachés
       • lot multi-nœuds: split sur SEPARATEUR_RE, réassignation 1:1
       • si #segments ≠ #nœuds : FALLBACK nœud-par-nœud (1 requête par nœud)

7. [Statut]      "✓ Traduit depuis <langue>" (ou "⚠ Traduit partiellement")
       → repli automatique en pilule [MT ✓] après 1,5 s (sauf échec partiel)

8. [Restauration] bouton « Original » : restaure chaque nœud depuis contenusOriginaux
```

### Protocole de message (background ↔ injected)

| Sens | Message | Réponse |
|------|---------|---------|
| background → injected | `{ action: "toggleBanner" }` | — (ouvre/ferme l'UI) |
| injected → background | `{ action: "translate", text, source, target }` | `{ success: true, text, detectedLang }` ou `{ success: false, error }` |

L'appel Google : `POST https://translate.googleapis.com/translate_a/single?client=gtx&sl=<src>&tl=<tgt>&dt=t`
avec corps `q=<texte>`. Réponse parsée : `donnees[0]` = segments `[trad, orig, …]`, `donnees[2]` =
code de langue détectée. Timeout : `AbortSignal.timeout(15000)` **par lot**. Les erreurs
reviennent sous forme de **codes** (`RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `TIMEOUT`, `NETWORK`) que
le script injecté traduit en messages localisés ; une réponse HTML/non-JSON (blocage/captcha) est
traitée comme `SERVICE_UNAVAILABLE`. Le payload entrant est validé côté background.

---

## 4. Interface utilisateur

Deux états, dans un **Shadow DOM** (isolation CSS totale) :

- **Pilule** (replié) : `[MT ▸]`, avec un indicateur `✓` après une traduction.
- **Bandeau** (déplié) : `[MT Translator | DE [auto] → VERS [fr] [Traduire] [Original] [▴]]`.

Transitions : `pilule.click → déplier` · `logo MT / bouton ▴ → replier` · `raccourci (Alt+Shift+T) → toggleBanner`.

Le raccourci est déclaré via la clé `commands` du manifest (remappable) ; `background.js` reçoit
`commands.onCommand` et envoie `toggleBanner` à l'onglet actif. Les éléments cliquables non natifs
(pilule, logo) sont `role="button"` + `tabindex="0"` (activables au clavier) ; le statut est une
région `aria-live` annoncée aux lecteurs d'écran.

Tout le CSS est dans une balise `<style>` du Shadow DOM ; classes préfixées `mt-`. Palette sombre
(violets `#a78bfa`/`#7c3aed`, vert succès `#34d399`, rouge erreur `#f87171`).

---

## 5. Internationalisation (i18n)

Deux mécanismes **distincts**, à ne pas confondre :

| Cible | Source | Pourquoi |
|-------|--------|----------|
| **Champs du manifest** (nom, description, titres bouton/menu) | `_locales/<lang>/messages.json` + `__MSG_clé__` | API i18n standard du manifest |
| **Textes de l'UI du bandeau** | dictionnaire `I18N` **embarqué** dans `translator-injected.js` | `browser.i18n.getMessage()` **indisponible** dans le contexte messageDisplay |

Langues d'UI : `fr, en, es, de, vi, ja, pt`. Détection : `browser.i18n.getUILanguage()` →
`navigator.language` → fallback **`en`**. Les noms de langues affichés (statut « Traduit depuis… »)
viennent de la table `NOMS_LANGUES`.

---

## 6. Cycle de vie et robustesse

- **Réinjection** : Thunderbird réutilise le même document HTML entre messages ; le script est
  réinjecté et appelle `nettoyerInstance()` en premier (supprime l'UI, `abort()` les écouteurs DOM,
  retire le listener runtime).
- **`AbortController`** (`document.documentElement._mtAbort`) : coupe les écouteurs DOM (ex. keydown)
  en une fois.
- **`MutationObserver`** (`_mtObserver`) : filet de sécurité — si le conteneur UI disparaît du
  `body`, l'observateur se déconnecte et relance `initialiser()`.
- **Verrouillage UI** pendant la traduction (boutons/sélecteurs `disabled`).

---

## 7. Sécurité (résumé)

Voir **`SECURITY.md`** pour le détail. Points structurants :

- **Aucune écriture HTML** : tout passe par `textContent`/`createTextNode`. Pas d'`innerHTML`,
  d'`eval`, ni d'`insertAdjacentHTML`. Le contenu d'e-mail (hostile) ne peut donc pas exécuter de
  code via l'extension.
- **Frontière de privilège** : seul `background.js` accède au réseau ; le script injecté passe par
  message-passing.
- **Donnée transmise à un tiers** : le corps des e-mails traduits est envoyé à Google. Aucune autre
  exfiltration : le harnais de débogage `remoteLog`/`DEBUG` a été **retiré en v2.0.9**.
- **Aucune persistance** : rien n'est stocké en `storage` ni mis en cache.

---

## 8. Limites connues

- **Incompatibilité Thunderbird Conversations** (architecture iframe) — voir `README.md`.
- **API Google `gtx` non officielle** : pas de garantie de service, peut casser sans préavis.
- **Tests** : les helpers de texte purs (`mt-text.js` — `decouperLong`, `extraireEspaces`) sont
  couverts par `test/text.test.js` (`npm test`, `node:test`). La logique UI/DOM (Shadow DOM,
  injection) reste testée manuellement dans Thunderbird.
