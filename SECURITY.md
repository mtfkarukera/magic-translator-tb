# Politique de sécurité — Magic Translator

## Signaler une vulnérabilité

Si vous découvrez une faille de sécurité ou un problème de confidentialité dans Magic Translator,
merci de le signaler **en privé** plutôt que via une issue publique :

- **Contact** : ouvrir un *security advisory* privé sur le dépôt GitHub, ou contacter directement le
  mainteneur (MTF Karukera).
- Merci d'inclure : version concernée, étapes de reproduction, et impact estimé.
- Délai de réponse visé : sous quelques jours. Une correction sera publiée dès que possible, avec
  crédit au rapporteur s'il le souhaite.

Versions supportées : la **dernière version publiée** reçoit les correctifs de sécurité.

---

## Modèle de menace

Magic Translator s'exécute dans Thunderbird et manipule un contenu **par nature hostile** : le corps
des e-mails. Les hypothèses structurantes sont :

1. **Le contenu d'un e-mail est contrôlé par un attaquant.** Le script de contenu s'exécute dans le
   document qui rend ce message. Tout texte issu du DOM du message est traité comme non fiable.
2. Thunderbird **sandboxe le rendu** des e-mails (pas d'exécution de scripts du message, contenu
   distant bloqué par défaut). L'extension ne s'appuie pas *uniquement* là-dessus pour sa sûreté.
3. La frontière de privilège est nette : seul `background.js` accède au réseau ; le script injecté
   passe par message-passing.

---

## Garanties de sécurité actuelles

- ✅ **Aucune écriture HTML.** Toutes les insertions de texte (UI et contenu du message) passent par
  `textContent` / `createTextNode`. Pas d'`innerHTML`, `outerHTML`, `insertAdjacentHTML`, ni `eval`.
  → un e-mail hostile **ne peut pas** exécuter de code via l'extension.
- ✅ **Aucune persistance de données.** Rien n'est écrit en `storage`, aucun cache du contenu des
  e-mails.
- ✅ **HTTPS forcé** pour l'unique appel réseau (Google Translate).
- ✅ **Isolation Shadow DOM** de l'interface.

---

## Flux de données — transparence

Pour traduire, l'extension **transmet le texte de l'e-mail concerné à un service tiers** :

| Donnée | Destinataire | Transport | Quand |
|--------|--------------|-----------|-------|
| Texte du message à traduire (peut inclure sujet/adresses si présents dans le corps collecté) | **Google Translate** (`translate.googleapis.com`, client `gtx`) | HTTPS | À chaque clic « Traduire » |

- Ces données transitent **directement** entre Thunderbird et Google ; elles ne passent par aucun
  serveur du projet.
- L'API `gtx` est **non officielle** : pas de contrat de service ni de garantie de confidentialité
  au-delà du transport HTTPS. La politique de confidentialité applicable est celle de Google.
- Aucune donnée n'est envoyée ailleurs en production.

> **Cohérence des déclarations** : le manifest déclare `data_collection_permissions: ["none"]`. Cette
> déclaration vise l'absence de collecte *par le projet*, mais ne reflète pas la transmission du
> contenu à Google. L'alignement de cette déclaration et de la documentation est un point de suivi
> (voir `PLAN_ACTION.md`).

---

## ✅ Résolu (v2.0.9) : retrait du harnais de débogage `remoteLog` / `DEBUG`

Les versions antérieures embarquaient un mécanisme de log de débogage (`remoteLog` piloté par
`const DEBUG`) qui, lorsqu'il était activé (`DEBUG = true`), envoyait le **contenu des e-mails**
(texte original et traduit, objet message complet) en HTTP non chiffré vers `http://localhost:9999`.

Il a été **entièrement retiré** des deux scripts en **v2.0.9**. Le débogage passe désormais par
`console.log` local uniquement. Aucun envoi réseau du contenu des messages n'existe plus en dehors de
l'appel de traduction à Google.

**Garde-fous anti-régression** (si ce type de code était réintroduit) :

- `build.sh` **refuse de packager** si `const DEBUG = true` est détecté.
- La skill `/revue-securite-pre-release` vérifie l'absence de `DEBUG = true` et de `localhost`.
- `*.log` est ignoré par Git pour empêcher tout commit de log contenant des PII.

---

## Bonnes pratiques pour les contributeurs

- Ne **jamais** logger le contenu des e-mails (`original`, `translated`, `text`, `message`) — seuls
  des compteurs/longueurs sont acceptables.
- Ne **jamais** introduire d'écriture HTML à partir de contenu du message.
- Toute évolution du flux de données (nouveau destinataire, nouvelle donnée envoyée) doit être
  reflétée ici, dans le `README.md` et dans `data_collection_permissions`.
- Exécuter le rituel de fin de sprint (`CONTRIBUTING.md`) avant tout commit ; la revue de sécurité
  pré-release (`/revue-securite-pre-release`) avant toute publication.
