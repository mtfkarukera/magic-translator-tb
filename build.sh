#!/usr/bin/env bash
#
# Magic Translator — packaging reproductible du XPI
# ═════════════════════════════════════════════════
# Produit  dist/magic-translator-<VERSION>.xpi
# + lien   dist/magic-translator.xpi  → la dernière version
#
# Garde-fou de confidentialité : refuse de packager si du code de débogage
# actif (DEBUG = true) est détecté dans les fichiers livrés.
#
# Usage :  bash build.sh   (ou : npm run build)

set -euo pipefail
cd "$(dirname "$0")"

NAME="magic-translator"
OUT_DIR="dist"

# ── Version lue depuis le manifest (source de vérité) ──────────────────────
VERSION=$(grep -m1 '"version"' manifest.json | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
if [ -z "${VERSION}" ]; then
  echo "❌ Impossible de lire la version dans manifest.json" >&2
  exit 1
fi
XPI="${OUT_DIR}/${NAME}-${VERSION}.xpi"

# ── Fichiers embarqués dans le XPI (runtime uniquement) ────────────────────
FILES=(
  manifest.json
  background.js
  mt-text.js
  translator-injected.js
  icon.png
  LICENSE
  _locales
)

# ── Garde-fou : interdire DEBUG = true dans le code packagé ────────────────
if grep -nE 'const[[:space:]]+DEBUG[[:space:]]*=[[:space:]]*true' background.js translator-injected.js mt-text.js; then
  echo "❌ ABANDON : DEBUG = true détecté. Repasser à false avant de packager." >&2
  exit 1
fi

# ── Avertissement : harnais remoteLog encore présent (non bloquant) ────────
if grep -qE 'localhost:9999' background.js translator-injected.js mt-text.js; then
  echo "⚠️  AVERTISSEMENT : référence à localhost:9999 (harnais remoteLog) présente dans le code." >&2
  echo "    DEBUG est à false (pas de fuite active), mais le retrait du harnais est recommandé." >&2
fi

# ── Construction ───────────────────────────────────────────────────────────
mkdir -p "${OUT_DIR}"
rm -f "${XPI}"
zip -r -FS "${XPI}" "${FILES[@]}" -x '*.DS_Store' >/dev/null
ln -sf "$(basename "${XPI}")" "${OUT_DIR}/${NAME}.xpi"

# ── Récapitulatif ──────────────────────────────────────────────────────────
echo "✅ Construit : ${XPI}"
echo "   Lien      : ${OUT_DIR}/${NAME}.xpi"
echo "   Contenu :"
unzip -l "${XPI}" | sed 's/^/     /'
