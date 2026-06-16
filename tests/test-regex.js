const text = "Dec 17, 2568 BE — ... it show date text before line";

const dateRegex = /^(?:\d{1,2}\s+[ก-๙a-zA-Z\.]+\s+\d{4}(?:\s+[A-Z]{2})?|[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}(?:\s+[A-Z]{2})?|\d+\s+(?:days?|hours?|minutes?|weeks?|months?|years?|วัน|ชม\.|นาที|ชั่วโมง|สัปดาห์|เดือน|ปี)s?\s*(?:ago|ที่แล้ว|ที่ผ่านมา)?)/i;

const match = text.match(dateRegex);
if (match) {
  const prefixLength = match[0].length;
  const rest = text.substring(prefixLength);
  console.log(`rest: "${rest}"`);
  const dashMatch = rest.match(/^\s*[\—\–\-]\s*/);
  if (dashMatch) {
    console.log(`dashMatch: "${dashMatch[0]}"`);
    console.log(`cleaned: "${rest.substring(dashMatch[0].length)}"`);
  } else {
    console.log("No dash match found!");
  }
} else {
  console.log("No date match found!");
}
