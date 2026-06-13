---
name: revue-securite-pre-release
description: Revue de sécurité et confidentialité ciblée à exécuter avant toute publication de Magic Translator (extension Thunderbird qui transmet le contenu d'e-mails à Google). Vérifie l'absence de code de débogage actif, le moindre privilège des permissions, l'absence d'injection HTML, et la cohérence des déclarations de flux de données. À utiliser avant une release, une soumission AMO, ou un commit touchant au réseau / au DOM du message.
---

# Revue de sécurité pré-release — Magic Translator

Checklist à dérouler **avant toute publication**. Référence : `SECURITY.md`. S'arrêter et signaler
tout point KO.

## 1. Pas de code de débogage actif (PRIORITÉ)

```bash
grep -nE 'const[[:space:]]+DEBUG[[:space:]]*=[[:space:]]*true' background.js translator-injected.js   # doit être VIDE
grep -nE 'localhost:9999' background.js translator-injected.js                                          # idéalement VIDE (harnais retiré)
```

- `DEBUG` **doit** valoir `false` dans les deux fichiers (sinon le contenu des e-mails fuite vers
  `http://localhost:9999`). `build.sh` bloque déjà ce cas, mais le vérifier ici.
- Vérifier qu'aucun `remoteLog`/`console.log` ne journalise le **contenu** des messages
  (`original`, `translated`, `text`, `message`).

## 2. Pas d'artefact contenant des PII

```bash
ls -1 *.log 2>/dev/null                 # debug.log ne doit pas traîner
git status --porcelain | grep -i '\.log' # aucun .log indexé
git log --all -- debug.log              # doit être vide (jamais committé)
```

## 3. Aucune injection HTML

```bash
grep -nE 'innerHTML|outerHTML|insertAdjacentHTML|\beval\(|document\.write' background.js translator-injected.js   # doit être VIDE
```

Toute écriture issue du contenu d'e-mail doit passer par `textContent` / `createTextNode`.

## 4. Moindre privilège (manifest)

- Vérifier que chaque permission de `manifest.json` est **réellement utilisée** :
  - `scripting` + `messagesRead` : requises par `registerScripts` (NE PAS retirer `messagesRead`).
  - `menus` : utilisée pour le menu clic-droit.
  - `storage` : **vérifier l'usage** — si aucun `storage.local`/`storage.sync` dans le code, la
    retirer.
- `host_permissions` limité à `https://translate.googleapis.com/*`.

## 5. Cohérence des déclarations de flux de données

- `data_collection_permissions` du manifest, `SECURITY.md` et `README.md` doivent **décrire le même
  flux** : le contenu des e-mails traduits est transmis à Google. Toute divergence est à corriger.

## 6. Lint de packaging

```bash
npm run lint:webext     # comparer à la baseline de faux positifs Thunderbird (voir CONTRIBUTING.md)
```

## Verdict

Conclure par un récapitulatif clair : ✅ prêt à publier, ou ❌ avec la liste des points bloquants et
leur emplacement (`fichier:ligne`).
