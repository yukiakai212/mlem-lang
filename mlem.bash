#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Check if an argument is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <file.mlem>"
  exit 1
fi

# Absolute path of the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Input file path (relative or absolute)
INPUT_FILE="$1"

# Call cli.js with the given file
node "$SCRIPT_DIR/cli.js" "$INPUT_FILE"
