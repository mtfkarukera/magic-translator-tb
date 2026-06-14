# Contribuer à Magic Translator

Merci de votre intérêt ! Ce guide résume l'essentiel pour contribuer proprement. Pour le détail
technique, voir **`ARCHITECTURE.md`**.

## Prérequis

- Mozilla Thunderbird **128.0+** (testé sur 151.x).
- Node.js + npm (pour ESLint et `web-ext`).
- `zip` (utilisé par `build.sh`).

```bash
npm install        # installe ESLint et globals (devDependencies)
npm test           # lance les tests unitaires (node:test, zéro dépendance)
```

## Démarrer

1. Charger l'extension en mode dev : **Outils → Outils de développement → Déboguer les modules
   complémentaires → Charger un module temporaire…** → sélectionner `manifest.json`.
2. Ouvrir un e-mail, cliquer **Traduire**, vérifier le comportement.

## Architecture en bref

Deux scripts, deux contextes (voir `ARCHITECTURE.md`) :

- `background.js` — contexte privilégié : enregistre le script de contenu, gère le bouton/menu, et
  **relaie les traductions vers Google** (seul à accéder au réseau).
- `translator-injected.js` — script de contenu : UI (Shadow DOM), collecte/réinjection du texte.

## Conventions

- **Langue du code : français.** Le code utilise des identifiants et commentaires en français
  (`traduireTexte`, `nettoyerInstance`…). Rester cohérent.
- **UI** : chaînes dans le dictionnaire `I18N` embarqué (`translator-injected.js`) **et**, si elles
  concernent le manifest, dans `_locales/`.
- **Style** : ESLint flat config (`eslint.config.js`). `no-var`/`prefer-const` en `error`.
- **Sécurité (non négociable)** : jamais d'`innerHTML`/`eval` ; tout passe par `textContent`. Jamais
  de log du contenu des e-mails. Voir `SECURITY.md`.

## Avant d'ouvrir une PR — rituel de fin de sprint

Tout changement suit le **rituel de fin de sprint**, dans l'ordre :

1. **Lint & tests** : `npm run lint` (0 erreur, 0 warning) + `npm test` (tests verts) + `npm run lint:webext`. `web-ext` est basé sur
   Firefox : 3 warnings sont des **faux positifs Thunderbird attendus** (`messagesRead` + 2×
   `data_collection_permissions`) ; tout dépassement de cette baseline est à corriger.
2. **Docs** : mettre à jour `README.md` / `ARCHITECTURE.md` si un comportement change.
3. **CHANGELOG.md** : ajouter une entrée datée, par catégories.
4. **Bump de version** : `manifest.json` **et** `package.json` (semver).
5. **Build** : `npm run build` → vérifier le contenu du `.xpi`.
6. **Recettage** : tester manuellement le flux complet + ce que le sprint a touché.
7. **Commit** : message conventionnel (`feat:`, `fix:`, `docs:`, `chore:`), arbre propre.

> Un correctif « rapide » post-sprint **renouvelle intégralement** le rituel.

## Messages de commit

Format conventionnel : `type(scope): description`. Types courants : `feat`, `fix`, `docs`, `chore`,
`ux`, `refactor`. Exemple : `fix(injected): préserver les retours à la ligne en texte brut`.

## Ce qui est particulièrement bienvenu

- Compatibilité avec **Thunderbird Conversations**.
- Moteurs de traduction alternatifs (DeepL, LibreTranslate auto-hébergé), avec choix du moteur.
- Nouvelles langues d'interface.
- Tests automatisés sur la logique de découpage/réassemblage par séparateur.
- Améliorations d'accessibilité.
