import test from "node:test";
import assert from "node:assert/strict";
import { sendApprovalRequestEmail } from "../email.ts";

test("aviso contém link HTML válido e informa aceite do provedor", async () => {
  process.env.MS_GRAPH_TENANT_ID = "test-tenant";
  process.env.MS_GRAPH_CLIENT_ID = "test-client";
  process.env.MS_GRAPH_CLIENT_SECRET = "test-secret";
  process.env.MS_GRAPH_SENDER_USER = "sender@example.test";
  process.env.APP_BASE_URL = "https://app.example.test";
  const originalFetch = globalThis.fetch;
  let html = "";
  globalThis.fetch = async (_input, init) => {
    if (typeof init?.body === "string" && init.body.startsWith("{")) {
      html = JSON.parse(init.body).message.body.content;
      return new Response(null, { status: 202 });
    }
    return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await sendApprovalRequestEmail({ invoiceNumber: "42", codigoIdentificador: "123", supplierName: "Fornecedor", recipients: ["gestor@example.test"], invoiceId: "nota-1" });
    assert.equal(result.simulated, false);
    assert.match(html, /href="https:\/\/app\.example\.test\/notas\/nota-1"/);
    assert.doesNotMatch(html, /href=\\"/);
  } finally { globalThis.fetch = originalFetch; }
});
