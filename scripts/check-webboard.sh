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
echo "SPAMWARDEN CONFIGURATION CONCEPT:"
echo "------------------------------------------------"
echo "Based on spamwarden.js configuration, you should use the Form ID, Input ID, and specify flags/endpoints."
echo ""

# Configuration Flags
SD_FLAG="1"       # 1 = Enable PII/DLP auditing (Recommended), 0 = Spam only
SIEM_ENDPOINT=""  # Optional custom SIEM endpoint

# Generate actual Base64 format: formId|inputId|sdFlag[|siemEndpoint]
if [ -n "$SIEM_ENDPOINT" ]; then
    RAW_CLIENT="$FINAL_FORM_ID|$FINAL_INPUT_ID|$SD_FLAG|$SIEM_ENDPOINT"
else
    RAW_CLIENT="$FINAL_FORM_ID|$FINAL_INPUT_ID|$SD_FLAG"
fi

B64_CLIENT=$(echo -n "$RAW_CLIENT" | base64)

echo "Suggested Client Values:"
echo "  Raw:    $RAW_CLIENT"
echo "  Base64: $B64_CLIENT"
echo ""
echo "Example Script Tag:"
echo "<script src=\"https://cdn.redsocs.com/js/spamwarden.min.js?client=$B64_CLIENT\"></script>"
echo "------------------------------------------------"
echo "Note: Ensure elements with IDs '$FINAL_FORM_ID' and '$FINAL_INPUT_ID' exist in your DOM."
