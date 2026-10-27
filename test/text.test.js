// Tests unitaires des helpers de texte purs (mt-text.js).
// Lancer avec : npm test   (équivalent à : node --test test/)
//
// mt-text.js n'a pas d'export : il s'exécute (effet de bord) et pose son API
// sur globalThis.MTText — on l'importe pour l'effet de bord, puis on la lit.

import { test } from "node:test";
import assert from "node:assert/strict";
import "../mt-text.js";

const { extraireEspaces, decouperLong, nettoyerTextePourDetection } = globalThis.MTText;

test("extraireEspaces : sépare lead / coeur / trail", () => {
  assert.deepEqual(extraireEspaces("  salut  "), { lead: "  ", coeur: "salut", trail: "  " });
  assert.deepEqual(extraireEspaces("hello"), { lead: "", coeur: "hello", trail: "" });
  assert.deepEqual(extraireEspaces("\n\nFoo\n"), { lead: "\n\n", coeur: "Foo", trail: "\n" });
});

test("extraireEspaces : préserve les espaces INTERNES", () => {
  const r = extraireEspaces("  a b  c  ");
  assert.equal(r.coeur, "a b  c");
  // Recollage lead + coeur + trail === original
  assert.equal(r.lead + r.coeur + r.trail, "  a b  c  ");
});

test("extraireEspaces : cas fréquent texte-avant-lien (espace de fin conservé)", () => {
  // « à l'adresse » suivi d'un lien : l'espace de fin doit rester dans trail.
  const r = extraireEspaces("in our gallery at ");
  assert.equal(r.coeur, "in our gallery at");
  assert.equal(r.trail, " ");
});

test("decouperLong : texte court non découpé", () => {
  assert.deepEqual(decouperLong("abc", 10), ["abc"]);
  assert.deepEqual(decouperLong("", 10), []);
});

test("decouperLong : recollage === original et segments ≤ maxLen", () => {
  const txt = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(300);
  const segs = decouperLong(txt, 4000);
  assert.ok(segs.length > 1, "doit produire plusieurs segments");
  assert.ok(segs.every((s) => s.length <= 4000), "chaque segment ≤ maxLen");
  assert.equal(segs.join(""), txt, "le recollage doit reconstituer l'original");
});

test("decouperLong : coupe de préférence sur un saut de ligne", () => {
  const txt = "a".repeat(3000) + "\n" + "b".repeat(3000);
  const segs = decouperLong(txt, 4000);
  assert.equal(segs.join(""), txt);
  assert.ok(segs.length >= 2);
});

test("decouperLong : coupe dure si aucun séparateur proche", () => {
  const txt = "x".repeat(9000); // aucun espace ni \n
  const segs = decouperLong(txt, 4000);
  assert.ok(segs.every((s) => s.length <= 4000));
  assert.equal(segs.join(""), txt);
});

test("nettoyerTextePourDetection : élimine les URLs et e-mails", () => {
  const source = "Consultez https://www.qobuz.com/fr-fr/shop pour commander ou écrivez à support-help@qobuz.com merci.";
  const nettoye = nettoyerTextePourDetection(source);
  assert.equal(nettoye, "Consultez pour commander ou écrivez à merci.");
});

test("nettoyerTextePourDetection : élimine les citations '>' et amorces de thread", () => {
  const source = `Bonjour Fred,

Voici les informations demandées.

> On Wed, Oct 21, 2026 at 14:55 PM, "Frédéric MOUTOU" <mtfredo@gmail.com> wrote:
> Bonjour, pouvez-vous m'aider ?
`;
  const nettoye = nettoyerTextePourDetection(source);
  assert.equal(nettoye, "Bonjour Fred, Voici les informations demandées.");
});

test("nettoyerTextePourDetection : gère les chaînes vides ou invalides", () => {
  assert.equal(nettoyerTextePourDetection(""), "");
  assert.equal(nettoyerTextePourDetection(null), "");
  assert.equal(nettoyerTextePourDetection(undefined), "");
});
