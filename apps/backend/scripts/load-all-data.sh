#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Loading all data (core + assessment)"
echo "=========================================="
echo ""

# Step 1: Disable triggers for core database
echo "Step 1/6: Disabling triggers for roar_core..."
"$SCRIPT_DIR/disable-triggers.sh" roar_core 5432

# Step 2: Load core data
echo ""
echo "Step 2/6: Loading core database data..."
"$SCRIPT_DIR/load-core-data.sh"

# Step 3: Enable triggers for core database
echo ""
echo "Step 3/6: Enabling triggers for roar_core..."
"$SCRIPT_DIR/enable-triggers.sh" roar_core 5432

# Step 4: Disable triggers for assessment database
echo ""
echo "Step 4/6: Disabling triggers for roar_assessment..."
"$SCRIPT_DIR/disable-triggers.sh" roar_assessment 5432

# Step 5: Load assessment data
echo ""
echo "Step 5/6: Loading assessment database data..."
"$SCRIPT_DIR/load-assessment-data.sh"

# Step 6: Enable triggers for assessment database
echo ""
echo "Step 6/6: Enabling triggers for roar_assessment..."
"$SCRIPT_DIR/enable-triggers.sh" roar_assessment 5432

echo ""
echo "=========================================="
echo "✅ All data loaded successfully!"
echo "=========================================="
