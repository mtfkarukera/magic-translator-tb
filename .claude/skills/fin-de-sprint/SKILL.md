---
name: fin-de-sprint
description: Exécute le rituel de fin de sprint OBLIGATOIRE de Magic Translator (extension Thunderbird), dans l'ordre strict. À utiliser pour clôturer un sprint, finaliser une tâche, préparer un commit/une release, ou après tout correctif post-sprint (« rapide » inclus). Couvre lint, docs, CHANGELOG, bump de version, build, plan de recettage et commit.
---

# Rituel de fin de sprint — Magic Translator

Ce rituel est **OBLIGATOIRE** à la fin de CHAQUE sprint, et **renouvelé INTÉGRALEMENT** après toute
correction post-sprint (un correctif « rapide » suit le même rituel). Référence : `CONTRIBUTING.md`.

Exécuter les étapes **dans l'ordre**. Ne pas en sauter. S'arrêter et signaler à l'utilisateur si une
étape échoue.

## 1. Lint (0 erreur, 0 warning)

```bash
npm run lint          # eslint background.js translator-injected.js
npm run lint:webext   # web-ext lint
```

- ESLint **doit** être à **0 erreur, 0 warning**. Corriger toute violation (le code mort se supprime,
  ne se tolère pas).
- `web-ext lint` : comparer à la **baseline de faux positifs Thunderbird** documentée dans `CONTRIBUTING.md`
  (warning `messagesRead` + 2× `data_collection_permissions`). Tout dépassement de cette baseline est
  à corriger.

## 2. Docs

Vérifier que `README.md`, `ARCHITECTURE.md` (et `SECURITY.md` si le flux de données change) reflètent
toujours le code. **Un sprint qui change un comportement utilisateur DOIT mettre le README à jour.**

## 3. CHANGELOG.md

Ajouter une entrée datée pour la version, par catégories : **Ajouté / Corrigé / Modifié / Sécurité /
Supprimé**.

## 4. Bump de version

Mettre à jour la version dans **`manifest.json` ET `package.json`** (les deux synchronisés).
Semver : correctif → patch, fonctionnalité/changement → minor.

> Si la version courante est déjà incrémentée et **non encore publiée**, y intégrer le sprint plutôt
> que de re-bumper. Confirmer avec l'utilisateur en cas de doute.

## 5. Build

```bash
npm run build         # bash build.sh
```

Vérifier le contenu du `.xpi` affiché (présence de `manifest.json`, `icon.png`, `LICENSE`,
`_locales/`) et le lien `dist/magic-translator.xpi`. Le build **échoue** si `DEBUG = true` — c'est
voulu.

## 6. Plan de recettage simplifié

Livrer à l'utilisateur une **liste courte de tests manuels** ciblés sur ce que le sprint a touché
(mode opératoire + résultat attendu), **plus** un test de non-régression du flux complet :

> Ouvrir un e-mail → cliquer **Traduire** → vérifier la traduction → bandeau replié en pilule `[MT ✓]`
> → cliquer **Original** → texte restauré. Tester aussi sur un e-mail en **texte brut** et un e-mail
> **multi-paragraphes**.

## 7. Commit

Message conventionnel (`feat:` / `fix:` / `docs:` / `chore:` / `ux:`). **Arbre propre après commit.**

⚠️ **Avant `git add`** : s'assurer qu'aucun `*.log` (PII potentielles) ni artefact de build n'est
indexé. Ces fichiers sont normalement couverts par `.gitignore` — vérifier `git status` avant de
committer.
