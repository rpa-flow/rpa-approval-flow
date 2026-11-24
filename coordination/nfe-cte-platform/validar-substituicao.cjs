// Executar com a porta do PostgreSQL descartável e o nome da sua base de QA.
// O destino é fixado em loopback e no usuário fiscal_fixture. Os dados são revertidos.
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const esbuild = require("esbuild");
const port = Number(process.argv[2]);
const database = process.argv[3] || "postgres";
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^(postgres|qa[_a-z0-9]*|fiscal[_a-z0-9]*)$/.test(database)) {
  throw Error("Informe a porta local (>=1024) e uma base de QA.");
}
const db = new PrismaClient({ datasources: { db: { url: `postgresql://fiscal_fixture@127.0.0.1:${port}/${database}?connect_timeout=3` } } });
const build = esbuild.buildSync({ stdin: { contents: `
  export { parseFiscalXml } from "./src/lib/fiscal-document-parser";
  export { receiveFiscalDocument } from "./src/lib/fiscal-document-ingest";
  export { reviewFiscalDocument } from "./src/lib/fiscal-document-review";
`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false });
const compiled = new Module("fiscal-qa");
compiled.paths = module.paths;
compiled._compile(build.outputFiles[0].text, path.resolve("fiscal-qa.cjs"));
const { parseFiscalXml, receiveFiscalDocument, reviewFiscalDocument } = compiled.exports;
const marker = new Error("ROLLBACK_FIXTURE");
const actor = { id: "qa-sintetico", nome: "QA", email: "qa@example.test", role: "ADMIN", allowedSupplierIds: [] };
const sequence = randomBytes(5).readUIntBE(0, 5).toString().padStart(13, "0");
const cnpj = "0" + sequence;
const issuer = "1" + sequence;
const key = index => String(index).padStart(31, "0") + sequence;
const at = new Date().toISOString();
const xml = (index, target, environment) => `<cteProc><CTe><infCte Id="CTe${key(index)}" versao="4.00"><ide><mod>57</mod><nCT>${index}</nCT>
  <dhEmi>${at}</dhEmi><tpAmb>${environment}</tpAmb><tpCTe>${target ? 3 : 0}</tpCTe><toma3><toma>3</toma></toma3></ide>
  <emit><CNPJ>${issuer}</CNPJ><xNome>Fictício</xNome></emit><dest><CNPJ>${cnpj}</CNPJ></dest>
  <vPrest><vTPrest>1.23</vTPrest></vPrest><infCTeNorm>${target ? `<infCteSub><chCte>${key(target)}</chCte></infCteSub>` : ""}</infCTeNorm>
  </infCte></CTe><protCTe><infProt><chCTe>${key(index)}</chCTe><tpAmb>${environment}</tpAmb><cStat>100</cStat><nProt>1</nProt></infProt></protCTe></cteProc>`;

async function run() {
  process.env.CTE_INGEST_ENABLED = "true";
  try {
    await db.$transaction(async tx => {
      const [identity] = await tx.$queryRaw`SELECT current_user AS role`;
      assert.equal(identity.role, "fiscal_fixture");
      await tx.company.create({ data: { cnpj, displayName: "Empresa sintética" } });
      const submit = (i, target, environment = "1") => {
        const text = xml(i, target, environment);
        return receiveFiscalDocument(tx, parseFiscalXml(text), text, null);
      };
      const original = await submit(1);
      assert.equal(original.status, 201);
      const first = await submit(2, 1);
      const second = await submit(3, 1);
      const unverified = await submit(4, 1, "2");
      assert.equal(unverified.body.fiscalStatus, "UNKNOWN");
      const currentReview = () => tx.invoiceAdminReview.findUniqueOrThrow({ where: { invoiceId: original.body.id } });
      assert.ok((await currentReview()).motivos.includes("CTE_SUBSTITUIDO"));
      async function removeReference(i, receipt) {
        const candidate = await submit(i);
        assert.equal(candidate.status, 409);
        await reviewFiscalDocument(tx, receipt.body.id, { action: "ACCEPT_VERSION", versionId: candidate.body.versionId,
          expectedVersionId: receipt.body.versionId, reason: "Correção sintética da referência" }, actor);
      }
      await removeReference(2, first);
      assert.equal((await currentReview()).status, "PENDENTE");
      await removeReference(3, second);
      const review = await currentReview();
      assert.equal(review.status, "LIBERADA");
      assert.ok(!review.motivos.includes("CTE_SUBSTITUIDO"));
      assert.equal(await tx.fiscalDocumentReference.count({ where: { targetInvoiceId: original.body.id } }), 3);
      assert.equal(await tx.noteAuditLog.count({ where: { invoiceId: original.body.id, actionType: "FISCAL_SUBSTITUTION_REMOVED" } }), 1);
      const earlySubstitute = await submit(5, 6, "2");
      const lateOriginal = await submit(6);
      assert.equal(earlySubstitute.body.fiscalStatus, "UNKNOWN");
      assert.equal(await tx.invoiceAdminReview.findUnique({ where: { invoiceId: lateOriginal.body.id } }), null);
      assert.equal(await tx.fiscalDocumentReference.count({ where: { targetInvoiceId: lateOriginal.body.id } }), 1);
      throw marker;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== marker) throw error;
    console.log("Substituição autorizada, referência informativa, revisão e histórico conferidos; dados sintéticos revertidos.");
  } finally { await db.$disconnect(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
