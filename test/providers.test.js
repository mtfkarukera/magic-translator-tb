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
  construireEndpointLLM,
  obtenirPatternOrigine,
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

test("nettoyerReponseLLM : suppression des balises markdown et guillemets superflus", () => {
  const { nettoyerReponseLLM } = globalThis.MTProviders;
  assert.equal(nettoyerReponseLLM("```\nBonjour le monde\n```"), "Bonjour le monde");
  assert.equal(nettoyerReponseLLM("```markdown\nBonjour le monde\n```"), "Bonjour le monde");
  assert.equal(nettoyerReponseLLM('"Bonjour le monde"'), "Bonjour le monde");
  assert.equal(nettoyerReponseLLM("« Bonjour le monde »"), "Bonjour le monde");
  assert.equal(nettoyerReponseLLM("   Bonjour le monde   "), "Bonjour le monde");
});

test("obtenirNomLangue : résolution des noms en clair", () => {
  const { obtenirNomLangue } = globalThis.MTProviders;
  assert.equal(obtenirNomLangue("fr"), "French");
  assert.equal(obtenirNomLangue("en"), "English");
  assert.equal(obtenirNomLangue("pt-br"), "Brazilian Portuguese");
  assert.equal(obtenirNomLangue("zh-cn"), "Simplified Chinese");
  assert.equal(obtenirNomLangue("de"), "German");
});

test("FournisseurGemini : rejet si clé absente et succès sur mock API", async () => {
  // Rejet si clé vide
  await assert.rejects(
    async () => {
      await FOURNISSEURS.gemini.traduire("Hello", "en", "fr", { apiKey: "" });
    },
    { message: "UNAUTHORIZED" }
  );

  // Mock appel réussi
  const fetchOriginal = globalThis.fetch;
  let urlAppelee = "";

  globalThis.fetch = async (url) => {
    urlAppelee = url;
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Bonjour" }]
            }
          }
        ]
      })
    };
  };

  try {
    const res = await traduire(
      { provider: "gemini", apiKey: "AIzaSyTestKey123", model: "gemini-3.5-flash-lite" },
      "Hello",
      "en",
      "fr"
    );
    assert.match(urlAppelee, /generativelanguage\.googleapis\.com/);
    assert.match(urlAppelee, /gemini-3\.5-flash-lite/);
    assert.equal(res.success, true);
    assert.equal(res.text, "Bonjour");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("listerModelesGemini : récupération et filtrage generateContent", async () => {
  const { listerModelesGemini } = globalThis.MTProviders;

  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      models: [
        {
          name: "models/gemini-3.5-flash-lite",
          displayName: "Gemini 3.5 Flash-Lite",
          supportedGenerationMethods: ["generateContent", "countTokens"]
        },
        {
          name: "models/embedding-001",
          displayName: "Embedding Model",
          supportedGenerationMethods: ["embedContent"]
        }
      ]
    })
  });

  try {
    const modeles = await listerModelesGemini("AIzaSyTestKey123");
    assert.equal(modeles.length, 1);
    assert.equal(modeles[0].id, "gemini-3.5-flash-lite");
    assert.equal(modeles[0].name, "Gemini 3.5 Flash-Lite");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("FournisseurOpenAICompatible : Cloud (OpenAI, Groq) vs Local (Ollama, LM Studio)", async () => {
  // Rejet si clé absente pour OpenAI
  await assert.rejects(
    async () => {
      await FOURNISSEURS.llm.traduire("Hello", "en", "fr", { preset: "openai", apiKey: "" });
    },
    { message: "UNAUTHORIZED" }
  );

  // Succès sans clé pour Ollama (local)
  const fetchOriginal = globalThis.fetch;
  let urlAppelee = "";
  let payloadRecu = null;

  globalThis.fetch = async (url, options) => {
    urlAppelee = url;
    payloadRecu = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: "Bonjour tout le monde" }
          }
        ]
      })
    };
  };

  try {
    const res = await traduire(
      {
        provider: "llm",
        preset: "ollama",
        url: "http://localhost:11434",
        model: "llama3.2"
      },
      "Hello everyone",
      "en",
      "fr"
    );
    assert.equal(urlAppelee, "http://localhost:11434/v1/chat/completions");
    assert.equal(payloadRecu.model, "llama3.2");
    assert.equal(res.success, true);
    assert.equal(res.text, "Bonjour tout le monde");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("construireEndpointLLM : normalisation des suffixes /v1 et URLs", () => {
  assert.equal(
    construireEndpointLLM("https://api.openai.com"),
    "https://api.openai.com/v1/chat/completions"
  );
  assert.equal(
    construireEndpointLLM("https://api.openai.com/"),
    "https://api.openai.com/v1/chat/completions"
  );
  assert.equal(
    construireEndpointLLM("https://api.openai.com/v1"),
    "https://api.openai.com/v1/chat/completions"
  );
  assert.equal(
    construireEndpointLLM("https://api.openai.com/v1/"),
    "https://api.openai.com/v1/chat/completions"
  );
  assert.equal(
    construireEndpointLLM("http://localhost:11434/v1/chat/completions"),
    "http://localhost:11434/v1/chat/completions"
  );
  assert.equal(
    construireEndpointLLM("http://localhost:1234/v1"),
    "http://localhost:1234/v1/chat/completions"
  );
  assert.equal(
    construireEndpointLLM(""),
    "https://api.openai.com/v1/chat/completions"
  );
});

test("obtenirPatternOrigine : patterns d'hôtes WebExtension par moteur", () => {
  // Google Translate par défaut
  assert.equal(obtenirPatternOrigine("google"), "https://translate.googleapis.com/*");
  assert.equal(obtenirPatternOrigine("inconnu"), "https://translate.googleapis.com/*");

  // DeepL Free vs Pro
  assert.equal(
    obtenirPatternOrigine("deepl", { deeplApiKey: "12345:fx" }),
    "https://api-free.deepl.com/*"
  );
  assert.equal(
    obtenirPatternOrigine("deepl", { deeplApiKey: "12345", deeplPlan: "free" }),
    "https://api-free.deepl.com/*"
  );
  assert.equal(
    obtenirPatternOrigine("deepl", { deeplApiKey: "12345", deeplPlan: "pro" }),
    "https://api.deepl.com/*"
  );

  // Google Gemini
  assert.equal(obtenirPatternOrigine("gemini"), "https://generativelanguage.googleapis.com/*");

  // LLM Hub Presets
  assert.equal(obtenirPatternOrigine("llm", { llmPreset: "openai" }), "https://api.openai.com/*");
  assert.equal(obtenirPatternOrigine("llm", { llmPreset: "groq" }), "https://api.groq.com/*");
  assert.equal(obtenirPatternOrigine("llm", { llmPreset: "mistral" }), "https://api.mistral.ai/*");

  // LLM Hub Local & Custom URLs (match patterns normalisés sans numéro de port)
  assert.equal(
    obtenirPatternOrigine("llm", { llmPreset: "ollama", llmBaseUrl: "http://localhost:11434/v1" }),
    "http://localhost/*"
  );
  assert.equal(
    obtenirPatternOrigine("llm", { llmPreset: "custom", llmBaseUrl: "https://llm.corp.local:8443/v1/chat" }),
    "https://llm.corp.local/*"
  );
  assert.equal(
    obtenirPatternOrigine("llm", { llmPreset: "lmstudio", llmBaseUrl: "http://127.0.0.1:1234/v1" }),
    "http://127.0.0.1/*"
  );

  // LibreTranslate
  assert.equal(
    obtenirPatternOrigine("libretranslate", { libretranslateUrl: "https://translate.mon-domaine.org:8080/api" }),
    "https://translate.mon-domaine.org/*"
  );
});
