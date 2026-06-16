const fs = require('fs');
const path = require('path');
const os = require('os');

function cleanDescription(text) {
  if (!text) return "";
  
  let clean = text;
  
  const dateRegex = /^(?:\d{1,2}\s+[ก-๙a-zA-Z\.]+\s+\d{4}(?:\s+[A-Z]{2})?|[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}(?:\s+[A-Z]{2})?|(?:\d+\s+(?:days?|hours?|hrs?|minutes?|mins?|weeks?|wks?|months?|mos?|years?|yrs?|seconds?|secs?|วัน|ชม\.|นาที|ชั่วโมง|สัปดาห์|เดือน|ปี)s?\s*(?:ago|ที่แล้ว|ที่ผ่านมา)?|yesterday))/i;
  
  const match = clean.match(dateRegex);
  if (match) {
    const prefixLength = match[0].length;
    const rest = clean.substring(prefixLength);
    const dashMatch = rest.match(/^\s*[\—\–\-]\s*/);
    if (dashMatch) {
      clean = rest.substring(dashMatch[0].length);
    }
  }
  
  clean = clean.replace(/\.{3,}/g, " ");
  clean = clean.replace(/\…/g, " ");
  clean = clean.replace(/\s+/g, " ").trim();
  
  return clean;
}

const filePath = path.join(os.homedir(), 'Downloads/safe.1781583601.txt');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const cleanedLines = lines.map(line => cleanDescription(line)).filter(line => line.length > 0);
  fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf-8');
  console.log(`Successfully cleaned ${filePath}`);
} else {
  console.log(`File not found: ${filePath}`);
}
