const sw = {
  _sanitizeData: function(text) {
    if (!text) return { text: "", sd: false };
    let sd = false;
    
    const cardRegex = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const phoneRegex = /\b(0)[-\s]?([689])[-\s]?(\d)(?:[-\s]?\d){7}\b/g;

    if (cardRegex.test(text)) sd = true;
    text = text.replace(cardRegex, "[CARD_MASKED]");
    
    if (emailRegex.test(text)) sd = true;
    text = text.replace(emailRegex, "[EMAIL_MASKED]");
    
    if (phoneRegex.test(text)) sd = true;
    text = text.replace(phoneRegex, "[PHONE_MASKED]");
    
    return { text: text, sd: sd };
  }
};

const tests = [
    "042-644225 pp@cma.com",
    "ติดต่อ pp@cma.com",
    "082922458",
    "082-6426912"
];

tests.forEach(t => {
    const res = sw._sanitizeData(t);
    console.log(`Input: "${t}" -> SD: ${res.sd}, Result: "${res.text}"`);
});