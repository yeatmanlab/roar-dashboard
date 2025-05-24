#!/bin/bash

# Directory containing the query files
QUERIES_DIR="src/composables/queries"

# Function to convert a js file to ts
convert_js_to_ts() {
  local jsFile="$1"
  local filename=$(basename "$jsFile" .js)
  local tsFile="${jsFile%.js}.ts"
  
  # Skip if ts file already exists
  if [ -f "$tsFile" ]; then
    echo "Skipping $filename, TypeScript file already exists"
    return
  fi
  
  # Copy file and rename with .ts extension
  cp "$jsFile" "$tsFile"
  
  # Add basic type annotations, focusing on important parameters
  if grep -q "useQuery" "$tsFile"; then
    # Add import for types
    sed -i '1s#^import { useQuery } from#import { useQuery, type UseQueryReturnType, type UseQueryOptions } from#' "$tsFile"
    
    # Add MaybeRefOrGetter import if not already present
    if ! grep -q "MaybeRefOrGetter" "$tsFile"; then
      sed -i 's/import { computed } from/import { computed, type MaybeRefOrGetter } from/' "$tsFile"
      if ! grep -q "computed" "$tsFile"; then
        sed -i '1s/^/import { type MaybeRefOrGetter } from '\''vue'\'';\n/' "$tsFile"
      fi
    fi
    
    # Update function signature with types
    sed -i 's/const \([a-zA-Z0-9]*\) = (\([^)]*\)) =>/const \1 = (\2): UseQueryReturnType =>/' "$tsFile"
    
    # Add types to common parameters
    sed -i 's/\(id\|userId\|orgId\|groupId\|taskId\) = undefined/\1: MaybeRefOrGetter<string | undefined | null> = undefined/' "$tsFile"
    sed -i 's/queryOptions = undefined/queryOptions?: UseQueryOptions/' "$tsFile"
  fi
  
  echo "Converted $jsFile to TypeScript"
}

# Function to convert a test js file to ts
convert_test_js_to_ts() {
  local jsFile="$1"
  local filename=$(basename "$jsFile" .test.js)
  local tsFile="${jsFile%.js}.ts"
  
  # Skip if ts file already exists
  if [ -f "$tsFile" ]; then
    echo "Skipping $filename test, TypeScript file already exists"
    return
  fi
  
  # Copy file and rename with .ts extension
  cp "$jsFile" "$tsFile"
  
  # Add QueryClient type
  sed -i '/import \* as VueQuery/a import { type QueryClient } from '\''@tanstack/vue-query'\'';' "$tsFile"
  
  # Add types to variables
  sed -i 's/let piniaInstance;/let piniaInstance: ReturnType<typeof createTestingPinia>;/' "$tsFile"
  sed -i 's/let queryClient;/let queryClient: QueryClient;/' "$tsFile"
  
  echo "Converted $jsFile test to TypeScript"
}

# Process all .js files in the queries directory
for jsFile in "$QUERIES_DIR"/*.js; do
  # Skip test files on the first pass
  if [[ "$jsFile" != *".test.js" ]]; then
    convert_js_to_ts "$jsFile"
  fi
done

# Process all test files
for jsFile in "$QUERIES_DIR"/*.test.js; do
  convert_test_js_to_ts "$jsFile"
done

echo "Conversion complete!" 