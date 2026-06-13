---
name: build-xpi
description: Construit et empaquette le XPI de Magic Translator (extension Thunderbird) de façon reproductible, puis en vérifie le contenu. À utiliser pour packager l'extension, produire un .xpi/.zip de release, ou vérifier ce qui sera livré aux utilisateurs.
---

# Build & packaging du XPI — Magic Translator

## Construire

```bash
npm run build        # équivalent : bash build.sh
```

Produit `dist/magic-translator-<VERSION>.xpi` (version lue dans `manifest.json`) et le lien
`dist/magic-translator.xpi`.

## Ce que `build.sh` fait

- Embarque **uniquement les fichiers runtime** : `manifest.json`, `background.js`,
  `translator-injected.js`, `icon.png`, `LICENSE`, `_locales/`. (Pas de docs, node_modules, build.sh,
  config…)
- **Garde-fou de confidentialité** : échoue si `const DEBUG = true` est présent dans le code.
- **Avertit** si une référence à `localhost:9999` (harnais `remoteLog`) subsiste.

## Vérifications après build

1. Le récapitulatif `unzip -l` liste bien `manifest.json`, `icon.png`, `LICENSE` et `_locales/`.
2. La version du nom de fichier correspond à `manifest.json` **et** `package.json`.
3. Aucun fichier parasite (`.DS_Store`, `debug.log`, docs) n'est embarqué.

## Installer le XPI dans Thunderbird

**Modules complémentaires** → ⚙️ → **Installer un module depuis un fichier…** → choisir le `.xpi` de
`dist/`.

## Notes

- `dist/`, `build/`, `*.xpi` et `*.zip` sont ignorés par Git : les artefacts ne se versionnent pas,
  ils se publient en *GitHub Releases*.
- Pré-requis : `zip` disponible dans le PATH.
