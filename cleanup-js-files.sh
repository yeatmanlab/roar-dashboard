#!/bin/bash

# Directory containing the query files
QUERIES_DIR="src/composables/queries"

# Count how many TypeScript files we have
TS_FILES_COUNT=$(find "$QUERIES_DIR" -name "*.ts" | wc -l)

# Verify that we have a reasonable number of TypeScript files before deleting JavaScript files
if [ "$TS_FILES_COUNT" -lt 10 ]; then
  echo "Warning: Found only $TS_FILES_COUNT TypeScript files. This seems too few."
  echo "No JavaScript files will be deleted. Please check the conversion process."
  exit 1
fi

# Now that we're confident, remove the JavaScript files
echo "Found $TS_FILES_COUNT TypeScript files. Proceeding with cleanup..."

# Function to delete a JavaScript file if TypeScript version exists
delete_js_file() {
  local jsFile="$1"
  local tsFile="${jsFile%.js}.ts"
  
  if [ -f "$tsFile" ]; then
    echo "Deleting $jsFile (TypeScript version exists)"
    rm "$jsFile"
  else
    echo "Keeping $jsFile (no TypeScript version found)"
  fi
}

# Process all .js files in the queries directory
for jsFile in "$QUERIES_DIR"/*.js; do
  delete_js_file "$jsFile"
done

echo "Cleanup complete!" 