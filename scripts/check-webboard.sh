#!/bin/bash

# scripts/check-webboard.sh
# A script to extract form and input IDs from a URL for SpamWarden configuration.
# Priority: ID > Name

URL=$1

if [ -z "$URL" ]; then
    echo "Usage: ./scripts/check-webboard.sh <URL>"
    exit 1
fi

echo "Fetching content from: $URL ..."
HTML=$(curl -s -L "$URL")

if [ -z "$HTML" ]; then
    echo "Error: Could not fetch content from $URL"
    exit 1
fi

echo "------------------------------------------------"
echo "SpamWarden Webboard Analysis"
echo "------------------------------------------------"

# Function to extract ID or Name with priority
extract_priority() {
    local tag_content="$1"
    local id=$(echo "$tag_content" | sed -E 's/.*id=["'\'']([^"'\'']+)["'\''].*/\1/;t;d')
    local name=$(echo "$tag_content" | sed -E 's/.*name=["'\'']([^"'\'']+)["'\''].*/\1/;t;d')
    
    if [ -n "$id" ]; then
        echo "ID:$id"
    elif [ -n "$name" ]; then
        echo "NAME:$name"
    else
        echo "NONE"
    fi
}

# Extract Tags
FORM_TAG=$(echo "$HTML" | grep -i "<form" | head -n 1)
SUBMIT_TAG=$(echo "$HTML" | grep -iE "<input[^>]*type=['\"]submit['\"]" | head -n 1)
TEXTAREA_TAG=$(echo "$HTML" | grep -i "<textarea" | head -n 1)

# Get Results
FORM_RES=$(extract_priority "$FORM_TAG")
SUBMIT_RES=$(extract_priority "$SUBMIT_TAG")
TEXTAREA_RES=$(extract_priority "$TEXTAREA_TAG")

# Process Form
if [[ $FORM_RES == ID:* ]]; then
    FINAL_FORM_ID=${FORM_RES#ID:}
    FORM_DISPLAY="  Target Form:  $FINAL_FORM_ID (via ID)"
elif [[ $FORM_RES == NAME:* ]]; then
    FINAL_FORM_ID=${FORM_RES#NAME:}
    FORM_DISPLAY="  Target Form:  $FINAL_FORM_ID (via Name - ID missing)"
else
    FINAL_FORM_ID="UNKNOWN_FORM"
    FORM_DISPLAY="  Target Form:  (None found)"
fi

# Process Message Field
if [[ $TEXTAREA_RES == ID:* ]]; then
    FINAL_INPUT_ID=${TEXTAREA_RES#ID:}
    INPUT_DISPLAY="  Target Input: $FINAL_INPUT_ID (via ID)"
elif [[ $TEXTAREA_RES == NAME:* ]]; then
    FINAL_INPUT_ID=${TEXTAREA_RES#NAME:}
    INPUT_DISPLAY="  Target Input: $FINAL_INPUT_ID (via Name - ID missing)"
else
    FINAL_INPUT_ID="UNKNOWN_INPUT"
    INPUT_DISPLAY="  Target Input: (None found)"
fi

# Output results
echo "FOUND ELEMENTS (Priority: ID > Name):"
echo "$FORM_DISPLAY"
echo "$INPUT_DISPLAY"

if [[ $SUBMIT_RES == ID:* ]]; then
    echo "  Submit Button: ${SUBMIT_RES#ID:} (via ID)"
elif [[ $SUBMIT_RES == NAME:* ]]; then
    echo "  Submit Button: ${SUBMIT_RES#NAME:} (via Name - ID missing)"
fi

echo "------------------------------------------------"
echo "SPAMWARDEN CONFIGURATION:"
echo "------------------------------------------------"
echo "SpamWarden will automatically protect your form using its built-in heuristic engine."
echo ""

# Configuration Flags
SD_FLAG="1"       # 1 = Enable PII/DLP auditing (Recommended), 0 = Spam only
SIEM_ENDPOINT=""  # Optional custom SIEM endpoint

# Mode B: Auto-Bind (sdFlag|siemEndpoint)
if [ -n "$SIEM_ENDPOINT" ]; then
    RAW_AUTO="$SD_FLAG|$SIEM_ENDPOINT"
else
    RAW_AUTO="$SD_FLAG"
fi

B64_AUTO=$(echo -n "$RAW_AUTO" | base64)

echo "Suggested Client Scripts:"
echo ""
echo "Option 1: Local-Only Auto-Protect (No Telemetry)"
echo "  Script: <script src=\"https://cdn.redsocs.com/js/spamwarden.min.js\" data-auto-protect></script>"
echo ""
echo "Option 2: Enterprise Telemetry (Auto-Bind + SIEM)"
echo "  Raw:    $RAW_AUTO"
echo "  Base64: $B64_AUTO"
echo "  Script: <script src=\"https://cdn.redsocs.com/js/spamwarden.min.js?client=$B64_AUTO\"></script>"
echo "------------------------------------------------"
echo "Note: SpamWarden automatically detects your form and protects all fields."
