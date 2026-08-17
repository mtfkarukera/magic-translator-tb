// Tests unitaires des adaptateurs de fournisseurs de traduction (mt-providers.js).
// Lancer avec : npm test   (équivalent à : node --test test/)

import { test } from "node:test";
import assert from "node:assert/strict";
import "../mt-providers.js";

const {
  normaliserCodeDeepL,
  obtenirEndpointDeepL,
  obtenirFournisseur,
  traduire,
  FOURNISSEURS
} = globalThis.MTProviders;

test("normaliserCodeDeepL : codes cibles spécifiques DeepL", () => {
  assert.equal(normaliserCodeDeepL("en"), "EN-US");
  assert.equal(normaliserCodeDeepL("en-US"), "EN-US");
  assert.equal(normaliserCodeDeepL("en-gb"), "EN-GB");
  assert.equal(normaliserCodeDeepL("pt"), "PT-PT");
  assert.equal(normaliserCodeDeepL("pt-br"), "PT-BR");
  assert.equal(normaliserCodeDeepL("zh"), "ZH-HANS");
  assert.equal(normaliserCodeDeepL("zh-cn"), "ZH-HANS");
  assert.equal(normaliserCodeDeepL("zh-tw"), "ZH-HANT");
});

test("normaliserCodeDeepL : codes standard 2 lettres en majuscules", () => {
  assert.equal(normaliserCodeDeepL("fr"), "FR");
  assert.equal(normaliserCodeDeepL("de"), "DE");
  assert.equal(normaliserCodeDeepL("es"), "ES");
  assert.equal(normaliserCodeDeepL("ja"), "JA");
  assert.equal(normaliserCodeDeepL("it"), "IT");
  assert.equal(normaliserCodeDeepL("ru"), "RU");
});

test("obtenirEndpointDeepL : détection Free vs Pro", () => {
  // Clé terminée par :fx (Free)
  assert.equal(
    obtenirEndpointDeepL("12345678-abcd:fx", "auto"),
    "https://api-free.deepl.com/v2/translate"
  );
  // Clé Pro standard
  assert.equal(
    obtenirEndpointDeepL("12345678-abcd", "auto"),
    "https://api.deepl.com/v2/translate"
  );
  // Forçage plan 'free'
  assert.equal(
    obtenirEndpointDeepL("12345678-abcd", "free"),
    "https://api-free.deepl.com/v2/translate"
  );
  // Forçage plan 'pro'
  assert.equal(
    obtenirEndpointDeepL("12345678-abcd:fx", "pro"),
    "https://api.deepl.com/v2/translate"
  );
});

test("obtenirFournisseur : récupération et fallback par défaut", () => {
  assert.equal(obtenirFournisseur("google"), FOURNISSEURS.google);
  assert.equal(obtenirFournisseur("deepl"), FOURNISSEURS.deepl);
  assert.equal(obtenirFournisseur("libretranslate"), FOURNISSEURS.libretranslate);
  // Fournisseur inconnu ou non défini -> fallback immédiat sur Google
  assert.equal(obtenirFournisseur("inconnu"), FOURNISSEURS.google);
  assert.equal(obtenirFournisseur(null), FOURNISSEURS.google);
});

test("DeepL : rejet immédiat si clé API absente", async () => {
  await assert.rejects(
    async () => {
      await FOURNISSEURS.deepl.traduire("Bonjour", "fr", "en", { apiKey: "" });
    },
    { message: "UNAUTHORIZED" }
  );
});

test("LibreTranslate : URL personnalisée avec nettoyage du slash final", async () => {
  // Mock fetch temporaire pour vérifier l'URL appelée
  const fetchOriginal = globalThis.fetch;
  let urlAppelee = "";

  globalThis.fetch = async (url) => {
    urlAppelee = url;
    return {
      ok: true,
      json: async () => ({ translatedText: "Hello", detectedLanguage: { language: "fr" } })
    };
  };

  try {
    const res = await traduire(
      { provider: "libretranslate", url: "http://localhost:5000///" },
      "Bonjour",
      "fr",
      "en"
    );
    assert.equal(urlAppelee, "http://localhost:5000/translate");
    assert.equal(res.success, true);
    assert.equal(res.text, "Hello");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
