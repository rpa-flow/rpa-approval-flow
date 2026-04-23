const XLSX = require("xlsx");
const fs = require("fs");
const crypto = require("crypto");

// ==========================
// PARAMS VIA CLI
// ==========================
const FILE_PATH = process.argv[2];
const SHEET_NAME = process.argv[3] || "Resumo";

if (!FILE_PATH) {
  console.error("❌ Informe o caminho do arquivo XLSX");
  console.log("Uso:");
  console.log('node generate-seed-data.js "./arquivo.xlsx" "NomeDaAba"');
  process.exit(1);
}

// ==========================
// HELPERS
// ==========================
function normalizeCNPJ(cnpj) {
  return String(cnpj || "").replace(/\D/g, "");
}

function extractEmail(raw) {
  if (!raw) return "";
  const match = raw.match(/<(.+)>/);
  return match ? match[1].trim().toLowerCase() : raw.trim().toLowerCase();
}

function extractName(raw) {
  if (!raw) return "";
  return raw.split("<")[0].trim();
}

function generatePassword() {
  return crypto
    .randomBytes(8)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .slice(0, 10);
}

// ==========================
// LOAD XLSX
// ==========================
if (!fs.existsSync(FILE_PATH)) {
  console.error(`❌ Arquivo não encontrado: ${FILE_PATH}`);
  process.exit(1);
}

const workbook = XLSX.readFile(FILE_PATH);

const sheet = workbook.Sheets[SHEET_NAME];

if (!sheet) {
  console.error(`❌ Aba "${SHEET_NAME}" não encontrada`);
  console.log("Abas disponíveis:", workbook.SheetNames);
  process.exit(1);
}

const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

// ==========================
// PROCESS
// ==========================
const result = [];
const gestoresMap = new Map();

for (const row of json) {
  const fornecedor = row["Fornecedor"];
  const cnpj = row["CNPJ"];
  const gestorRaw = row["E-MAIL - DE QUEM VALIDA"];

  if (!fornecedor || !cnpj || !gestorRaw) continue;

  const email = extractEmail(gestorRaw);
  const nome = extractName(gestorRaw);

  if (!email) continue;

  result.push({
    fornecedor: fornecedor.trim(),
    cnpj: normalizeCNPJ(cnpj),
    gestor: { nome, email }
  });

  if (!gestoresMap.has(email)) {
    gestoresMap.set(email, generatePassword());
  }
}

// ==========================
// OUTPUTS
// ==========================

// JSON dados
fs.writeFileSync(
  "dados.json",
  JSON.stringify(result, null, 2),
  "utf-8"
);

// JSON senhas
fs.writeFileSync(
  "gestores.json",
  JSON.stringify(Object.fromEntries(gestoresMap), null, 2),
  "utf-8"
);

// CSV credenciais
const linhas = ["email,senha"];
for (const [email, senha] of gestoresMap.entries()) {
  linhas.push(`${email},${senha}`);
}

fs.writeFileSync("gestores.csv", linhas.join("\n"), "utf-8");

console.log("✅ Processamento concluído");
console.log(`Arquivo: ${FILE_PATH}`);
console.log(`Aba: ${SHEET_NAME}`);
console.log(`Gestores únicos: ${gestoresMap.size}`);