#!/bin/bash
# Build SpamWarden.js
# Usage: ./build.sh
set -e
cd "$(dirname "$0")"
node build.js "$@"
