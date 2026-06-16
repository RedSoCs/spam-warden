const sw = {
  _sanitizeData: function(text) {
    if (!text) return { text: "", sd: false };
    let sd = false;
    
    // Improved Regexes without \b for better Thai compatibility
    const cardRegex = /(?:^|\s|\b)(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})(?:\s|\b|$)/g;
    const emailRegex = /(?:^|\s|\b)([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?:\s|\b|$)/g;
    // Matches 0 + (2-9) + 7 or 8 more digits (9-10 digits total)
    const phoneRegex = /(?:^|\s|\b)(0[-\s]?[2-9](?:[-\s]?\d){7,8})(?:\s|\b|$)/g;

    const t1 = text.replace(cardRegex, " [CARD_MASKED] ");
    if (t1 !== text) sd = true;
    
    const t2 = t1.replace(emailRegex, " [EMAIL_MASKED] ");
    if (t2 !== t1) sd = true;
    
    const t3 = t2.replace(phoneRegex, " [PHONE_MASKED] ");
    if (t3 !== t2) sd = true;
    
    return { text: t3.trim(), sd: sd };
  }
};

const tests = [
    "042-644225 pp@cma.com",
    "082922458",
    "082-6426912",
    "ติดต่อ pp@cma.com",
    "โทร 0826426963"
];

tests.forEach(t => {
    const res = sw._sanitizeData(t);
    console.log(`Input: "${t}" -> SD: ${res.sd}, Result: "${res.text}"`);
});