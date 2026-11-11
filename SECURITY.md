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
   passe par message-passing, et les actions sensibles d'administration (`testProvider`, `listGeminiModels`) vérifient strictement l'origine `options/options.html` de l'émetteur.

---

## Garanties de sécurité actuelles

- ✅ **Aucune écriture HTML.** Toutes les insertions de texte (UI et contenu du message) passent par
  `textContent` / `createTextNode` / `DOMParser`. Pas d'`innerHTML`, `outerHTML`, `insertAdjacentHTML`, ni `eval`.
  → un e-mail hostile **ne peut pas** exécuter de code via l'extension.
- ✅ **Aucune persistance disque du contenu des e-mails.** Seules les préférences d'options et les clés d'API sont stockées localement via `browser.storage.local`. En mode rédaction, l'instantané d'annulation avant traduction (`compose_orig_<tabId>`) réside exclusivement en mémoire vive éphémère (`browser.storage.session`) et disparaît dès la restauration ou à la fermeture de Thunderbird.
- ✅ **Consentement explicite préalable (Opt-In — `provider: "none"` par défaut).** Aucun moteur de traduction ni relais de secours n'est activé avant le choix explicite de l'utilisateur (assistant de premier lancement `setup/setup.html` ou bandeau de consentement inline en 1 clic, avec case optionnelle dédiée pour MyMemory). Tant qu'aucun fournisseur n'est sélectionné, zéro requête réseau (`fetch`) n'est émise (politique *fail-closed*).
- ✅ **HTTPS strictement imposé hors bouclage local & CSP `connect-src`.** Conformément aux règles de sécurité de Mozilla Thunderbird (`cleartext-transmission`), toute connexion vers un serveur distant ou une adresse IP de réseau local (LAN) exige obligatoirement le protocole chiffré `https://`. Le protocole `http://` est strictement restreint aux adresses de bouclage local `localhost` et `127.0.0.1` (en parité 1:1 avec `host_permissions` et la directive CSP `connect-src https: http://localhost:* http://127.0.0.1:*`), et aucune clé d'API (`Authorization` / `api_key`) n'est jamais transmise sur `http://`.
- ✅ **Cloisonnement contre l'injection de prompt LLM.** Pour Google Gemini et le Hub LLMs, le texte de l'e-mail est encapsulé dans des balises `<source_text>...</source_text>` avec consigne système explicite de ne jamais exécuter les instructions contenues dans le corps du message.
- ✅ **Isolation Shadow DOM** de l'interface utilisateur dans le panneau de lecture.

---

## Flux de données — transparence

Pour traduire, l'extension **transmet le texte de l'e-mail concerné uniquement au service explicitement choisi par l'utilisateur** :

| Donnée | Destinataire | Transport | Quand |
|--------|--------------|-----------|-------|
| **Corps rendu** du message à traduire (ou brouillon en mode rédaction) | Moteur choisi par l'utilisateur (**Google Translate**, **MyMemory**, **DeepL API**, **Google Gemini API**, **LLMs Cloud/Locaux** ou **LibreTranslate**). Bascule vers MyMemory uniquement si explicitement cochée (`enableMyMemoryFallback`). | `https://` obligatoire (ou `http://` strictement sur `localhost` / `127.0.0.1` sans clé d'API) | Uniquement après Opt-In explicite, au clic « Traduire » (ou en mode 1-clic / 0-clic activé par l'utilisateur) |

- Ces données transitent **directement** entre votre client Thunderbird et le service de traduction choisi ; elles ne passent par aucun serveur intermédiaire du projet.
- **Seul le corps rendu est collecté** (`document.body` du document de contenu du message). Le bloc
  d'en-têtes géré par Thunderbird (de / à / sujet) est *hors* de ce document et n'est donc **pas**
  transmis — vérifiable : le sujet affiché dans l'en-tête n'est jamais traduit en mode lecture.
- La politique de confidentialité applicable pour le traitement linguistique est celle du fournisseur actif (Google, MyMemory, DeepL, OpenAI, Mistral, Groq ou l'hébergeur de l'instance LibreTranslate).
- Aucune donnée de télémétrie, analytique ou publicitaire n'est collectée.

> **Déclaration alignée (v2.0.10+)** : le manifest déclare
> `data_collection_permissions: { required: ["personalCommunications"] }` — le contenu des messages
> traduits est transmis au fournisseur choisi par l'utilisateur.

---

## ✅ Résolu (v2.0.9) : retrait du harnais de débogage `remoteLog` / `DEBUG`

Les versions antérieures embarquaient un mécanisme de log de débogage (`remoteLog` piloté par
`const DEBUG`) qui, lorsqu'il était activé (`DEBUG = true`), envoyait le **contenu des e-mails**
(texte original et traduit, objet message complet) en HTTP non chiffré vers `http://localhost:9999`.

Il a été **entièrement retiré** des scripts en **v2.0.9**. Le débogage passe désormais par
`console.log` local uniquement.

**Garde-fous anti-régression** :

- `build.sh` **refuse de packager** si `const DEBUG = true` est détecté.
- `npm run lint:webext` exécute `thunderbird/webext-linter --warnings-as-errors` sur le `.xpi` compilé.
- `*.log` et `.env*` sont ignorés par Git pour empêcher tout commit de log ou secret.

---

## Bonnes pratiques pour les contributeurs

- Ne **jamais** logger le contenu des e-mails (`original`, `translated`, `text`, `message`) — seuls
  des compteurs/longueurs sont acceptables.
- Ne **jamais** introduire d'écriture HTML non sanitisée à partir de contenu du message.
- Toute évolution du flux de données (nouveau destinataire, nouvelle donnée envoyée) doit être
  reflétée ici, dans `PRIVACY_POLICY.md`, dans le `README.md` et dans `data_collection_permissions`.
- Exécuter le rituel de fin de sprint (`CONTRIBUTING.md`) avant tout commit.
