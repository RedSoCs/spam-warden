const fs = require('fs');

function cleanDescription(text) {
  if (!text) return "";
  
  let clean = text;
  
  // Expanded Regex matching common date prefix patterns:
  // - "Dec 17, 2568 BE" or "Oct 12, 2023"
  // - "17 ธ.ค. 2568" or "12 ตุลาคม 2566"
  // - "3 วันที่ผ่านมา", "4 ชม. ที่ผ่านมา", "3 days ago", "1 hr ago", "30 mins ago", "yesterday"
  const dateRegex = /^(?:\d{1,2}\s+[ก-๙a-zA-Z\.]+\s+\d{4}(?:\s+[A-Z]{2})?|[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}(?:\s+[A-Z]{2})?|(?:\d+\s+(?:days?|hours?|hrs?|minutes?|mins?|weeks?|wks?|months?|mos?|years?|yrs?|seconds?|secs?|วัน|ชม\.|นาที|ชั่วโมง|สัปดาห์|เดือน|ปี)s?\s*(?:ago|ที่แล้ว|ที่ผ่านมา)?|yesterday))/i;
  
  // If the string starts with a date pattern followed by a dash separator
  const match = clean.match(dateRegex);
  if (match) {
    const prefixLength = match[0].length;
    const rest = clean.substring(prefixLength);
    const dashMatch = rest.match(/^\s*[\—\–\-]\s*/);
    if (dashMatch) {
      clean = rest.substring(dashMatch[0].length);
    }
  }
  
  // Remove trailing/leading/internal ellipses (...)
  clean = clean.replace(/\.{3,}/g, " ");
  clean = clean.replace(/\…/g, " ");
  
  // Normalize whitespace
  clean = clean.replace(/\s+/g, " ").trim();
  
  return clean;
}

const samples = [
  "Dec 17, 2568 BE — ... 1. Data Minimization (PDPA)",
  "Dec 17, 2568 BE — ...it show date text before line, it should been clean out too",
  "Dec 17, 2568 BE — ... ข้อมูลผู้ใช้ไม่ถูกส่งออกนอกเบราว์เซอร์",
  "3 mins ago — This is a newly updated text",
  "1 hr ago — Another snippet",
  "yesterday — Yesterday was a good day",
  "12 hours ago – Something happened",
  "5 วันที่ผ่านมา - ข้อความสำคัญ"
];

samples.forEach(s => {
  console.log(`Input:  "${s}"`);
  console.log(`Output: "${cleanDescription(s)}"\n`);
});
