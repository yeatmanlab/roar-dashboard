#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$PWD"
CERT_DIR="$REPO_ROOT/certs"

# Ensure the certs directory exists
mkdir -p "$CERT_DIR"

# Ensure mkcert root CA is installed
mkcert -install

# Generate single cert for both frontend + backend
mkcert \
  -key-file "$CERT_DIR/roar-local.key" \
  -cert-file "$CERT_DIR/roar-local.crt" \
  roar.local roar-backend.local localhost

echo "✅ Certificates created in $CERT_DIR"