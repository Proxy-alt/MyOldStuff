#!/usr/bin/env bash

OUTPUT="src_bundle.txt"
SRC_DIR="."

# Allow exclusions via arguments:
# Example: ./bundle-src.sh --exclude node_modules --exclude "src/admin"
EXCLUDES=()

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --exclude)
      EXCLUDES+=("$2")
      shift
      ;;
  esac
  shift
done

# Build the find command dynamically
FIND_CMD=(find "$SRC_DIR" -type f)

for EX in "${EXCLUDES[@]}"; do
  FIND_CMD+=(-not -path "$EX/*")
done

# Clear output file
echo "Bundling files from $SRC_DIR..." > "$OUTPUT"
echo "" >> "$OUTPUT"

# Append each file with a header
while IFS= read -r FILE; do
  echo "===== FILE: $FILE =====" >> "$OUTPUT"
  cat "$FILE" >> "$OUTPUT"
  echo -e "\n\n" >> "$OUTPUT"
done < <("${FIND_CMD[@]}")

echo "Done. Output written to $OUTPUT"
