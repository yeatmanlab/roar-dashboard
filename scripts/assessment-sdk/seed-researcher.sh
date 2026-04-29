#!/bin/bash
# Seed researcher data for local development
# Usage: npm run seed:researcher

set -e

DB_URL="postgresql://postgres:postgres@localhost:5433/roar_core"

echo "🌱 Seeding researcher data..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql "$DB_URL" < "$SCRIPT_DIR/seed-researcher-simple.sql"
echo "✅ Researcher data seeded successfully!"
