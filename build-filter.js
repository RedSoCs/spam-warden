const fs = require("fs");
const path = require("path");

// 1. Define input and output paths
const inputFile = path.join(__dirname, "data/spam/filter_list.txt");
const outputFile = path.join(__dirname, "src", "spamwarden-data.js");

// 2. Read and parse the text file
let spamLinks = [];
try {
  const fileContent = fs.readFileSync(inputFile, "utf8");
  spamLinks = fileContent
    .split(/\r?\n/) // Split by newlines (handles Windows & Mac/Linux)
    .map((line) => line.trim()) // Remove accidental spaces
    .filter((line) => line.length > 0) // Remove empty lines
    .filter((line) => !line.startsWith("#")); // Allow comments using '#' in the txt file
} catch (error) {
  console.error(`❌ Build Failed: Could not read ${inputFile}`);
  console.error(error.message);
  process.exit(1);
}

if (spamLinks.length === 0) {
  console.warn(
    "⚠️ Warning: Your filter_list.txt is empty. Building an empty filter.",
  );
} else {
  console.log(`✅ Loaded ${spamLinks.length} domains from filter_list.txt`);
}

// 3. Generate and write the client file
const obfuscatedLinks = spamLinks.map(str => {
  const codes = [];
  for (let i = 0; i < str.length; i++) {
    codes.push(str.charCodeAt(i) - 100);
  }
  return codes;
});

const clientCode = `module.exports = ${JSON.stringify(obfuscatedLinks)};\n`;

// Ensure the target directory exists before writing
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, clientCode);
console.log(
  `✅ Filter list built successfully! Wrote ${spamLinks.length} obfuscated domains to ${outputFile}`,
);
