# Changelog

Toutes les modifications notables de **Magic Translator** sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit le
[versionnage sémantique](https://semver.org/lang/fr/).

> Les entrées antérieures à 2.0.8 sont **reconstituées à partir de l'historique Git** (le projet ne
> tenait pas de changelog jusqu'ici) ; elles regroupent les changements par version telle que
> référencée dans les messages de commit.

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
