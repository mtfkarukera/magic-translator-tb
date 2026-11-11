// Tests unitaires des adaptateurs de fournisseurs de traduction (mt-providers.js).
// Lancer avec : npm test   (équivalent à : node --test test/)

import { test } from "node:test";
import assert from "node:assert/strict";
import "../mt-providers.js";

const {
  estHoteLoopback,
  validerUrlSecurisee,
  normaliserCodeDeepL,
  obtenirEndpointDeepL,
  obtenirFournisseur,
  traduire,
  testerConnexion,
  construireEndpointLLM,
  obtenirPatternOrigine,
  TIMEOUT_CLOUD_MS,
  TIMEOUT_LOCAL_MS,
  FOURNISSEURS
} = globalThis.MTProviders;

test("Timeouts différenciés : Cloud 10s vs Moteurs Locaux/Lourds 60s", () => {
  assert.equal(TIMEOUT_CLOUD_MS, 10000);
  assert.equal(TIMEOUT_LOCAL_MS, 60000);
});

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

test("obtenirFournisseur : récupération et politique fail-closed sur 'none' ou inconnu", async () => {
  assert.equal(obtenirFournisseur("google"), FOURNISSEURS.google);
  assert.equal(obtenirFournisseur("deepl"), FOURNISSEURS.deepl);
  assert.equal(obtenirFournisseur("libretranslate"), FOURNISSEURS.libretranslate);
  // État non configuré ou inconnu -> fail-closed strict (aucune exfiltration vers Google)
  assert.equal(obtenirFournisseur("none").id, "none");
  assert.equal(obtenirFournisseur("inconnu").id, "none");
  assert.equal(obtenirFournisseur(null).id, "none");
  await assert.rejects(
    async () => {
      await traduire({ provider: "inconnu" }, "Bonjour", "fr", "en");
    },
    { message: "CONSENT_REQUIRED" }
  );
});

test("DeepL : rejet immédiat si clé API absente", async () => {
  await assert.rejects(
    async () => {
      await FOURNISSEURS.deepl.traduire("Bonjour", "fr", "en", { apiKey: "" });
    },
    { message: "UNAUTHORIZED" }
  );
});

test("LibreTranslate : URL loopback autorisée en HTTP, rejet LAN/distant en HTTP (CLEARTEXT_FORBIDDEN)", async () => {
  // Mock fetch temporaire pour vérifier l'URL appelée
  const fetchOriginal = globalThis.fetch;
  let urlAppelee = "";
  let bodyAppele = null;

  globalThis.fetch = async (url, opts) => {
    urlAppelee = url;
    bodyAppele = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({ translatedText: "Hello", detectedLanguage: { language: "fr" } })
    };
  };

  try {
    const res = await traduire(
      { provider: "libretranslate", url: "http://localhost:5000///", apiKey: "secret-should-not-go-over-http" },
      "Bonjour",
      "fr",
      "en"
    );
    assert.equal(urlAppelee, "http://localhost:5000/translate");
    assert.equal(res.success, true);
    assert.equal(res.text, "Hello");
    // Aucune clé API ne doit être transmise sur du HTTP non chiffré
    assert.equal(bodyAppele.api_key, undefined);

    // Test de normalisation avec /translate déjà présent sur loopback 127.0.0.1
    await traduire(
      { provider: "libretranslate", url: "http://127.0.0.1:5000/translate/" },
      "Bonjour",
      "fr",
      "en"
    );
    assert.equal(urlAppelee, "http://127.0.0.1:5000/translate");

    // Rejet strict d'une IP LAN en HTTP non chiffré (politique Mozilla Thunderbird)
    await assert.rejects(
      async () => {
        await traduire(
          { provider: "libretranslate", url: "http://192.168.1.50:5000/translate/" },
          "Bonjour",
          "fr",
          "en"
        );
      },
      { message: "CLEARTEXT_FORBIDDEN" }
    );

    // Rejet fail-closed d'une URL malformée (aucune redirection silencieuse vers libretranslate.com)
    urlAppelee = "";
    await assert.rejects(
      async () => {
        await traduire(
          { provider: "libretranslate", url: "not-a-valid-url" },
          "Bonjour",
          "fr",
          "en"
        );
      },
      { message: "INVALID_PAYLOAD" }
    );
    assert.equal(urlAppelee, "");
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
  // Google Translate explicite vs moteur inconnu (fail-closed)
  assert.equal(obtenirPatternOrigine("google"), "https://translate-pa.googleapis.com/*");
  assert.equal(obtenirPatternOrigine("inconnu"), "");

  // MyMemory API
  assert.equal(obtenirPatternOrigine("mymemory"), "https://api.mymemory.translated.net/*");

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

test("FournisseurGoogle (Translate-PA) : succès sur mock JSON", async () => {
  const fetchOriginal = globalThis.fetch;
  let urlAppelee = "";

  globalThis.fetch = async (url) => {
    urlAppelee = url;
    return {
      ok: true,
      json: async () => ({ translation: "Good morning", sourceLanguage: "fr" })
    };
  };

  try {
    const res = await FOURNISSEURS.google.traduire("Bonjour", "fr", "en");
    assert.equal(res.success, true);
    assert.equal(res.text, "Good morning");
    assert.equal(res.detectedLang, "fr");
    assert.ok(urlAppelee.includes("translate-pa.googleapis.com/v1/translate"));
    assert.ok(urlAppelee.includes("params.client=gtx"));
    assert.ok(urlAppelee.includes("key=AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA"));
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("FournisseurMyMemory : succès et construction URL", async () => {
  const fetchOriginal = globalThis.fetch;
  let urlAppelee = "";

  globalThis.fetch = async (url) => {
    urlAppelee = url;
    return {
      ok: true,
      json: async () => ({
        responseData: { translatedText: "Hello world" },
        matches: [{ source: "fr-FR", target: "en-GB" }]
      })
    };
  };

  try {
    const res = await FOURNISSEURS.mymemory.traduire("Bonjour le monde", "fr", "en", {
      mymemoryEmail: "test@mtfk.fr"
    });
    assert.equal(res.success, true);
    assert.equal(res.text, "Hello world");
    assert.equal(res.detectedLang, "fr");
    assert.ok(urlAppelee.includes("api.mymemory.translated.net/get"));
    assert.ok(urlAppelee.includes("langpair=fr%7Cen"));
    assert.ok(urlAppelee.includes("de=test%40mtfk.fr"));
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("FournisseurGoogle : bascule sur MyMemory si erreur 429 UNIQUEMENT lorsque enableMyMemoryFallback est activé", async () => {
  const fetchOriginal = globalThis.fetch;
  let appels = [];

  globalThis.fetch = async (url) => {
    appels.push(url);
    if (url.includes("translate-pa.googleapis.com")) {
      return { ok: false, status: 429 };
    }
    return {
      ok: true,
      json: async () => ({
        responseData: { translatedText: "Hello from MyMemory" },
        matches: [{ source: "fr-FR" }]
      })
    };
  };

  try {
    // 1. Par défaut (enableMyMemoryFallback non activé) : aucun appel vers MyMemory, rejette RATE_LIMITED
    await assert.rejects(
      async () => {
        await FOURNISSEURS.google.traduire("Bonjour", "fr", "en", { enableMyMemoryFallback: false });
      },
      { message: "RATE_LIMITED" }
    );
    assert.equal(appels.length, 1);
    assert.ok(appels[0].includes("translate-pa.googleapis.com"));

    // 2. Avec enableMyMemoryFallback: true explicite : bascule vers MyMemory et expose effectiveProvider
    appels = [];
    const res = await FOURNISSEURS.google.traduire("Bonjour", "fr", "en", { enableMyMemoryFallback: true });
    assert.equal(res.success, true);
    assert.equal(res.text, "Hello from MyMemory");
    assert.equal(res.effectiveProvider, "mymemory");
    assert.equal(res.effectiveLabel, "MyMemory");
    assert.equal(appels.length, 2);
    assert.ok(appels[0].includes("translate-pa.googleapis.com"));
    assert.ok(appels[1].includes("api.mymemory.translated.net"));

    // 3. testerConnexion() désactive le secours MyMemory pour ne pas masquer une panne Google
    appels = [];
    const testGoogle = await testerConnexion({ provider: "google", enableMyMemoryFallback: true });
    assert.equal(testGoogle.success, false);
    assert.equal(testGoogle.message, "RATE_LIMITED");
    assert.equal(appels.length, 1);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("Opt-In explicite ATN : rejet CONSENT_REQUIRED si provider est 'none' ou absent", async () => {
  await assert.rejects(
    async () => {
      await traduire({ provider: "none" }, "Bonjour", "fr", "en");
    },
    { message: "CONSENT_REQUIRED" }
  );

  await assert.rejects(
    async () => {
      await traduire({}, "Bonjour", "fr", "en");
    },
    { message: "CONSENT_REQUIRED" }
  );

  const testRes = await testerConnexion({ provider: "none" });
  assert.equal(testRes.success, false);
  assert.equal(testRes.message, "CONSENT_REQUIRED");
  assert.equal(obtenirPatternOrigine("none"), "");
});

test("Sécurité HTTPS vs Loopback (estHoteLoopback & validerUrlSecurisee)", () => {
  // Hôtes loopback strictement alignés sur manifest.json (http://localhost/* et http://127.0.0.1/*)
  assert.equal(estHoteLoopback("localhost"), true);
  assert.equal(estHoteLoopback("127.0.0.1"), true);

  // Variantes hors match patterns de manifest.json (bloquées de façon homogène)
  assert.equal(estHoteLoopback("ollama.localhost"), false);
  assert.equal(estHoteLoopback("127.10.20.30"), false);
  assert.equal(estHoteLoopback("[::1]"), false);
  assert.equal(estHoteLoopback("0.0.0.0"), false);

  // Hôtes LAN et distants non-loopback
  assert.equal(estHoteLoopback("192.168.1.50"), false);
  assert.equal(estHoteLoopback("10.0.0.5"), false);
  assert.equal(estHoteLoopback("api.openai.com"), false);

  // Validation d'URL
  assert.equal(validerUrlSecurisee("http://localhost:11434").valide, true);
  assert.equal(validerUrlSecurisee("http://localhost:11434").estLoopbackHttp, true);
  assert.equal(validerUrlSecurisee("https://192.168.1.50:8443").valide, true);
  assert.equal(validerUrlSecurisee("https://192.168.1.50:8443").estLoopbackHttp, false);

  const rejetLan = validerUrlSecurisee("http://192.168.1.50:11434");
  assert.equal(rejetLan.valide, false);
  assert.equal(rejetLan.erreur, "CLEARTEXT_FORBIDDEN");

  const rejetDistant = validerUrlSecurisee("http://api.mon-serveur.com/v1");
  assert.equal(rejetDistant.valide, false);
  assert.equal(rejetDistant.erreur, "CLEARTEXT_FORBIDDEN");
});

test("FournisseurMyMemory : sous-découpage automatique des textes longs (> 450 car.) et nettoyage", async () => {
  const fetchOriginal = globalThis.fetch;
  const appels = [];

  globalThis.fetch = async (url) => {
    appels.push(url);
    const parsedUrl = new URL(url);
    const q = parsedUrl.searchParams.get("q") || "";
    // Vérifier qu'aucune sous-requête ne dépasse la limite stricte de 450 caractères
    assert.ok(q.length <= 450, `Le paramètre q (${q.length} car) dépasse la limite de 450`);
    return {
      ok: true,
      json: async () => ({
        responseData: {
          translatedText: `<g id="1">${q.toUpperCase()}</g> &quot;ok&quot;`
        },
        matches: [{ source: "fr-FR" }]
      })
    };
  };

  try {
    // Texte de 1 000 caractères avec plusieurs phrases
    const phrase = "Ceci est une phrase de test pour valider le découpage interne de MyMemory. ";
    const texteLong = phrase.repeat(14); // ~1 050 caractères

    const res = await FOURNISSEURS.mymemory.traduire(texteLong, "fr", "en");
    assert.equal(res.success, true);
    // Doit avoir nécessité au moins 3 sous-requêtes
    assert.ok(appels.length >= 3, `Nombre d'appels attendu >= 3, reçu : ${appels.length}`);
    // Vérifier le nettoyage des balises <g> et des entités &quot;
    assert.ok(!res.text.includes("<g"), "Les balises <g> doivent être nettoyées");
    assert.ok(!res.text.includes("&quot;"), "Les entités &quot; doivent être décodées");
    assert.ok(res.text.includes('"ok"'), 'Les guillemets décodés "ok" doivent être présents');
    assert.equal(res.detectedLang, "fr");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("FournisseurMyMemory : rejet si responseStatus non 200 (403/400)", async () => {
  const fetchOriginal = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      responseStatus: 403,
      responseData: { translatedText: "PLEASE SELECT TWO DISTINCT LANGUAGES" }
    })
  });

  try {
    await assert.rejects(
      async () => {
        await FOURNISSEURS.mymemory.traduire("Bonjour", "fr", "fr");
      },
      { message: "RATE_LIMITED" }
    );
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("FournisseurGemini : utilisation du header x-goog-api-key et systemInstruction", async () => {
  const fetchOriginal = globalThis.fetch;
  let headersRecus = null;
  let bodyRecu = null;

  globalThis.fetch = async (url, options) => {
    headersRecus = options.headers;
    bodyRecu = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Bonjour monde" }] } }]
      })
    };
  };

  try {
    const res = await FOURNISSEURS.gemini.traduire("Hello world", "en", "fr", {
      apiKey: "AIzaSyTest123",
      model: "gemini-3.5-flash-lite"
    });
    assert.equal(res.success, true);
    assert.equal(res.text, "Bonjour monde");
    assert.equal(headersRecus["x-goog-api-key"], "AIzaSyTest123");
    assert.ok(bodyRecu.systemInstruction, "systemInstruction doit être présent");
    assert.ok(bodyRecu.systemInstruction.parts[0].text.includes("from English into French"));
    assert.equal(bodyRecu.contents[0].parts[0].text, "<source_text>\nHello world\n</source_text>");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("FournisseurMyMemory : sous-découpage UTF-8 en octets pour les textes CJK multi-octets", async () => {
  const fetchOriginal = globalThis.fetch;
  const encodeur = new TextEncoder();
  const appels = [];

  globalThis.fetch = async (url) => {
    appels.push(url);
    const parsedUrl = new URL(url);
    const q = parsedUrl.searchParams.get("q") || "";
    const octets = encodeur.encode(q).length;
    assert.ok(octets <= 450, `Le paramètre q (${octets} octets UTF-8) dépasse la limite de 450 octets`);
    return {
      ok: true,
      json: async () => ({
        responseData: { translatedText: "Translated CJK segment." },
        matches: [{ source: "ja-JP" }]
      })
    };
  };

  try {
    // 320 caractères japonais (~960 octets UTF-8, bien que length <= 450)
    const phraseJa = "これは日本語のメール本文のテスト文章です。"; // 21 caractères = 63 octets UTF-8
    const texteJa = phraseJa.repeat(16); // 336 caractères = 1 008 octets UTF-8
    assert.ok(texteJa.length < 450);
    assert.ok(encodeur.encode(texteJa).length > 900);

    const res = await FOURNISSEURS.mymemory.traduire(texteJa, "ja", "fr");
    assert.equal(res.success, true);
    assert.ok(appels.length >= 3, `Attendu >= 3 sous-requêtes UTF-8, reçu : ${appels.length}`);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

