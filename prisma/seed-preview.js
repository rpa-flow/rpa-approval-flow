/* eslint-disable no-console */
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ADMIN_EMAIL = "gestor.teste@empresa.com";
const DEFAULT_PASSWORD = "123456";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function upsertManager({ nome, email, role = "GESTOR", ativo = true }) {
  return prisma.manager.upsert({
    where: { email },
    update: {
      nome,
      role,
      ativo
    },
    create: {
      nome,
      email,
      senhaHash: hashPassword(DEFAULT_PASSWORD),
      role,
      ativo
    }
  });
}

async function upsertSupplier({ nome, cnpj, codigoExterno }) {
  return prisma.supplier.upsert({
    where: { cnpj },
    update: {
      nome,
      codigoExterno
    },
    create: {
      nome,
      cnpj,
      codigoExterno
    }
  });
}

async function linkManagerSupplier(managerId, supplierId) {
  await prisma.managerSupplier.upsert({
    where: {
      managerId_supplierId: {
        managerId,
        supplierId
      }
    },
    update: {},
    create: {
      managerId,
      supplierId
    }
  });
}

async function upsertInvoice(data) {
  return prisma.invoice.upsert({
    where: { codigoIdentificador: data.codigoIdentificador },
    update: data,
    create: data
  });
}

async function upsertStatusHistory(invoice, actor, previousStatus, reason) {
  await prisma.noteStatusHistory.create({
    data: {
      invoiceId: invoice.id,
      actorId: actor.id,
      actorName: actor.nome,
      actorEmail: actor.email,
      previousStatus,
      newStatus: invoice.status,
      reason
    }
  });
}

async function main() {
  console.log("Iniciando seed manual de preview/testes...");

  const admin = await upsertManager({
    nome: "Gestor Teste",
    email: ADMIN_EMAIL,
    role: "ADMIN"
  });

  await prisma.manager.updateMany({
    where: {
      email: { not: ADMIN_EMAIL },
      role: "ADMIN"
    },
    data: { role: "GESTOR" }
  });

  const managers = await Promise.all([
    upsertManager({ nome: "Ana Gestora Fake", email: "gestor.fake01@empresa.com" }),
    upsertManager({ nome: "Bruno Gestor Fake", email: "gestor.fake02@empresa.com" }),
    upsertManager({ nome: "Carla Gestora Fake", email: "gestor.fake03@empresa.com" }),
    upsertManager({ nome: "Diego Gestor Fake", email: "gestor.fake04@empresa.com" })
  ]);

  const suppliers = await Promise.all([
    upsertSupplier({ nome: "Fornecedor Fake Tecnologia Ltda", cnpj: "00000000000191", codigoExterno: "PREV-001" }),
    upsertSupplier({ nome: "Fornecedor Fake Facilities S.A.", cnpj: "00000000000272", codigoExterno: "PREV-002" }),
    upsertSupplier({ nome: "Fornecedor Fake Consultoria ME", cnpj: "00000000000353", codigoExterno: "PREV-003" }),
    upsertSupplier({ nome: "Fornecedor Fake Logística Ltda", cnpj: "00000000000434", codigoExterno: "PREV-004" })
  ]);

  for (const supplier of suppliers) {
    await linkManagerSupplier(admin.id, supplier.id);
  }

  await linkManagerSupplier(managers[0].id, suppliers[0].id);
  await linkManagerSupplier(managers[1].id, suppliers[1].id);
  await linkManagerSupplier(managers[2].id, suppliers[2].id);
  await linkManagerSupplier(managers[3].id, suppliers[3].id);
  await linkManagerSupplier(managers[0].id, suppliers[2].id);

  await prisma.notificationRule.upsert({
    where: { id: "preview-global-rule" },
    update: {
      diasLembrete: 2,
      ativo: true,
      destinatarioAdicional: "financeiro.preview@empresa.com"
    },
    create: {
      id: "preview-global-rule",
      diasLembrete: 2,
      ativo: true,
      destinatarioAdicional: "financeiro.preview@empresa.com"
    }
  });

  for (const [index, supplier] of suppliers.entries()) {
    await prisma.supplierNotificationConfig.upsert({
      where: { supplierId: supplier.id },
      update: {
        ativo: true,
        recorrenciaDias: index + 2,
        emailsExtras: [`compras.fake${index + 1}@empresa.com`]
      },
      create: {
        supplierId: supplier.id,
        ativo: true,
        recorrenciaDias: index + 2,
        emailsExtras: [`compras.fake${index + 1}@empresa.com`]
      }
    });
  }

  const invoices = [
    {
      codigoIdentificador: "PREVIEW-000000000000000000000000000000000001",
      numeroNota: "PV-1001",
      fornecedorId: suppliers[0].id,
      criadoPorId: admin.id,
      status: "AGUARDANDO_APROVACAO",
      processada: false,
      statusProcessamento: "PENDENTE",
      dataEmissao: daysFromNow(-10),
      dataCompetencia: daysFromNow(-10),
      prestadorCnpj: suppliers[0].cnpj,
      prestadorNome: suppliers[0].nome,
      prestadorEmail: "financeiro.tecnologia.fake@empresa.com",
      tomadorCnpj: "99999999000199",
      tomadorNome: "Empresa Tomadora Fake",
      tomadorEmail: "tomador.fake@empresa.com",
      valorBaseCalculo: "15000.00",
      valorIssqn: "300.00",
      valorTotalRetido: "450.00",
      valorServico: "15000.00",
      valorLiquido: "14550.00",
      aliquota: "2.00"
    },
    {
      codigoIdentificador: "PREVIEW-000000000000000000000000000000000002",
      numeroNota: "PV-1002",
      fornecedorId: suppliers[1].id,
      criadoPorId: managers[1].id,
      status: "APROVADO",
      processada: false,
      statusProcessamento: "PROCESSANDO",
      tentativasNotificacao: 1,
      ultimoLembreteEm: daysFromNow(-2),
      dataEmissao: daysFromNow(-8),
      dataCompetencia: daysFromNow(-8),
      prestadorCnpj: suppliers[1].cnpj,
      prestadorNome: suppliers[1].nome,
      prestadorEmail: "financeiro.facilities.fake@empresa.com",
      valorBaseCalculo: "8200.00",
      valorIssqn: "164.00",
      valorTotalRetido: "246.00",
      valorServico: "8200.00",
      valorLiquido: "7954.00",
      aliquota: "2.00"
    },
    {
      codigoIdentificador: "PREVIEW-000000000000000000000000000000000003",
      numeroNota: "PV-1003",
      fornecedorId: suppliers[2].id,
      criadoPorId: managers[2].id,
      status: "RECUSADO",
      processada: false,
      statusProcessamento: "ERRO",
      tentativasNotificacao: 2,
      dataEmissao: daysFromNow(-12),
      dataCompetencia: daysFromNow(-12),
      observacaoValidacao: "Dados bancários divergentes para cenário de teste.",
      responsavelValidacao: managers[2].nome,
      dataValidacao: daysFromNow(-1),
      prestadorCnpj: suppliers[2].cnpj,
      prestadorNome: suppliers[2].nome,
      valorBaseCalculo: "4300.00",
      valorIssqn: "86.00",
      valorTotalRetido: "129.00",
      valorServico: "4300.00",
      valorLiquido: "4171.00",
      aliquota: "2.00"
    },
    {
      codigoIdentificador: "PREVIEW-000000000000000000000000000000000004",
      numeroNota: "PV-1004",
      fornecedorId: suppliers[3].id,
      criadoPorId: managers[3].id,
      status: "PROCESSADO",
      processada: true,
      statusProcessamento: "CONCLUIDO",
      statusIntegracaoDelphi: "SUCESSO",
      dataProcessamento: daysFromNow(-1),
      dataLancamentoDelphi: daysFromNow(-1),
      dataPagamento: daysFromNow(15),
      codigoDelphi: "DLP-PREV-1004",
      dataEmissao: daysFromNow(-15),
      dataCompetencia: daysFromNow(-15),
      prestadorCnpj: suppliers[3].cnpj,
      prestadorNome: suppliers[3].nome,
      valorBaseCalculo: "23100.00",
      valorIssqn: "462.00",
      valorTotalRetido: "693.00",
      valorServico: "23100.00",
      valorLiquido: "22407.00",
      aliquota: "2.00"
    },
    {
      codigoIdentificador: "PREVIEW-000000000000000000000000000000000006",
      numeroNota: "PV-1006",
      fornecedorId: suppliers[1].id,
      criadoPorId: admin.id,
      status: "DADOS_INCONSISTENTES",
      processada: false,
      statusProcessamento: "PENDENTE",
      statusIntegracaoDelphi: "FALHA",
      dataEmissao: daysFromNow(-4),
      dataCompetencia: daysFromNow(-4),
      observacaoValidacao: "CNPJ do prestador inconsistente para teste de validação.",
      prestadorCnpj: "12345678901234",
      prestadorNome: suppliers[1].nome,
      valorBaseCalculo: "6700.00",
      valorIssqn: "134.00",
      valorTotalRetido: "201.00",
      valorServico: "6700.00",
      valorLiquido: "6499.00",
      aliquota: "2.00"
    }
  ];

  await prisma.invoice.deleteMany({
    where: {
      codigoIdentificador: "PREVIEW-000000000000000000000000000000000005"
    }
  });

  const persistedInvoices = [];
  for (const invoiceData of invoices) {
    persistedInvoices.push(await upsertInvoice(invoiceData));
  }

  const previewInvoiceIds = persistedInvoices.map((invoice) => invoice.id);

  await prisma.noteNotification.deleteMany({
    where: { invoiceId: { in: previewInvoiceIds } }
  });
  await prisma.noteStatusHistory.deleteMany({
    where: { invoiceId: { in: previewInvoiceIds } }
  });

  await upsertStatusHistory(persistedInvoices[1], managers[1], "AGUARDANDO_APROVACAO", "Aprovação fake para testes de fluxo.");
  await upsertStatusHistory(persistedInvoices[2], managers[2], "AGUARDANDO_APROVACAO", "Recusa fake para validar tela de histórico.");
  await upsertStatusHistory(persistedInvoices[3], admin, "APROVADO", "Processamento fake concluído com sucesso.");
  await upsertStatusHistory(persistedInvoices[4], admin, "AGUARDANDO_APROVACAO", "Inconsistência fake para homologação.");

  await prisma.noteNotification.createMany({
    data: [
      {
        invoiceId: persistedInvoices[0].id,
        recipients: [managers[0].email, "compras.fake1@empresa.com"],
        success: true
      },
      {
        invoiceId: persistedInvoices[4].id,
        recipients: [admin.email],
        success: false,
        error: "Falha fake de envio para teste de auditoria."
      }
    ],
    skipDuplicates: true
  });

  await prisma.serviceEvaluation.upsert({
    where: { invoiceId: persistedInvoices[3].id },
    update: {
      managerId: managers[3].id,
      managerName: managers[3].nome,
      managerEmail: managers[3].email,
      rating: 5,
      comment: "Fornecedor fake com entrega dentro do SLA.",
      riskLevel: "BAIXO",
      qualifica: true
    },
    create: {
      invoiceId: persistedInvoices[3].id,
      managerId: managers[3].id,
      managerName: managers[3].nome,
      managerEmail: managers[3].email,
      rating: 5,
      comment: "Fornecedor fake com entrega dentro do SLA.",
      riskLevel: "BAIXO",
      qualifica: true
    }
  });

  console.log("Seed manual de preview/testes concluído com sucesso.");
  console.log(`Admin único: ${ADMIN_EMAIL}`);
  console.log(`Senha padrão dos usuários do seed: ${DEFAULT_PASSWORD}`);
  console.log(`Gestores fake criados: ${managers.map((manager) => manager.email).join(", ")}`);
  console.log(`Fornecedores fake criados: ${suppliers.map((supplier) => supplier.nome).join(", ")}`);
  console.log(`Notas fake criadas: ${persistedInvoices.map((invoice) => invoice.numeroNota).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
