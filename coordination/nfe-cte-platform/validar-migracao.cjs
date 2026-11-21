// Executar no diretório raiz. O único destino admitido é um PGlite em memória.
// O argumento é o caminho local de uma instalação isolada de @electric-sql/pglite.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { PGlite } = require(path.resolve(process.argv[2]));

async function verify() {
  const db = new PGlite();
  const migrations = fs.readdirSync("prisma/migrations", { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name).sort();
  const target = "20261120120000_fiscal_documents";
  const apply = name => db.exec(fs.readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
  const one = async sql => (await db.query(sql)).rows[0];
  try {
    for (const name of migrations.filter(name => name < target)) await apply(name);
    await db.exec(`INSERT INTO "Supplier" (id,nome,"updatedAt") VALUES ('s','Fictício',now());
      INSERT INTO "Company" (id,cnpj,"displayName","updatedAt") VALUES ('c','00000000000001','Fictícia',now());
      INSERT INTO "Invoice" (id,"codigoIdentificador","numeroNota","fornecedorId","dataAtualizacao","documentType","valorServico","tomadorCnpj","xmlOriginal") VALUES
      ('i','old-1','1','s',now(),'NFSE',123.45,'00000000000001','<NFSe>test</NFSe>'),
      ('u','old-2','2','s',now(),null,0,null,null);
      INSERT INTO "ApprovalWorkflow" (id,"documentType","updatedAt") VALUES ('w','NFSE',now());
      INSERT INTO "ApprovalWorkflowVersion" (id,"workflowId",number,"createdById","updatedAt") VALUES ('v','w',1,'actor',now());
      INSERT INTO "InvoiceWorkflow" (id,"invoiceId","versionId") VALUES ('e','i','v');`);
    await apply(target);
    assert.deepEqual(await one(`SELECT "companyId","referenceValue"::text AS valor,"xmlOriginal" FROM "Invoice" WHERE id='i'`),
      { companyId: "c", valor: "123.45", xmlOriginal: "<NFSe>test</NFSe>" });
    assert.equal((await one(`SELECT "documentType" FROM "Invoice" WHERE id='u'`)).documentType, null);
    assert.deepEqual(await one(`SELECT "currentInvoiceId","documentVersionId" FROM "InvoiceWorkflow" WHERE id='e'`),
      { currentInvoiceId: "i", documentVersionId: "initial:i" });
    assert.equal((await one(`SELECT "contentHash" FROM "FiscalDocumentVersion" WHERE "invoiceId"='i'`)).contentHash,
      createHash("sha256").update("<NFSe>test</NFSe>").digest("hex"));
    await assert.rejects(db.exec(`INSERT INTO "InvoiceWorkflow" (id,"invoiceId","versionId") VALUES ('e2','i','v')`), /unique/);
    for (const status of ["ACTIVE", "BLOCKED"]) {
      await assert.rejects(db.exec(`UPDATE "InvoiceWorkflow" SET status='${status}',"currentInvoiceId"=NULL WHERE id='e'`), /check constraint/);
    }
    await db.exec(`UPDATE "InvoiceWorkflow" SET "currentInvoiceId"=NULL,status='SUPERSEDED' WHERE id='e';
      INSERT INTO "InvoiceWorkflow" (id,"invoiceId","versionId") VALUES ('e2','i','v')`);
    assert.equal((await one(`SELECT count(*)::int n FROM "InvoiceWorkflow" WHERE "invoiceId"='i'`)).n, 2);
    assert.equal((await one(`SELECT id FROM "InvoiceWorkflow" WHERE "currentInvoiceId"='i'`)).id, "e2");
    await assert.rejects(db.exec(`UPDATE "Invoice" SET "fornecedorId"=NULL WHERE id='u'`), /check constraint/);
    await db.exec(`INSERT INTO "Invoice" (id,"codigoIdentificador","numeroNota","dataAtualizacao","documentType")
      VALUES ('n','new','1',now(),'NFE')`);
    await assert.rejects(db.exec(`INSERT INTO "FiscalDocumentVersion" (id,"invoiceId","contentHash",xml,"parserVersion",state)
      VALUES('dup','i',repeat('a',64),'diff','1','CURRENT')`), /unique/);
    await db.exec(fs.readFileSync("coordination/nfe-cte-platform/conferencia-migracao.sql", "utf8"));
    console.log(`${migrations.filter(name => name <= target).length} migrations; reconciliação, versões e ciclos conferidos em PostgreSQL embarcado.`);
  } finally {
    await db.close();
  }
}
verify().catch(error => { console.error(error.message); process.exitCode = 1; });
