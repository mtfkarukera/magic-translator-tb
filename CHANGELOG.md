# Changelog

Toutes les modifications notables de **Magic Translator** sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit le
[versionnage sémantique](https://semver.org/lang/fr/).

> Les entrées antérieures à 2.0.8 sont **reconstituées à partir de l'historique Git** (le projet ne
> tenait pas de changelog jusqu'ici) ; elles regroupent les changements par version telle que
> référencée dans les messages de commit.

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

[2.0.8]: #208--2026-06-13
[2.0.7]: #207--2026-06-07
[2.0.5]: #205--2026-06-07
[2.0.4]: #204--2026-06-07
[2.0.3]: #203--2026-06-07
[2.0.1]: #201--2026-06-07
[2.0.0]: #200--2026-06-03
