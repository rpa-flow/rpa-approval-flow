/* eslint-disable no-console */
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function upsertInvoice(data) {
  await prisma.invoice.upsert({
    where: { codigoIdentificador: data.codigoIdentificador },
    update: data,
    create: data
  });
}

async function main() {
  const supplierA = await prisma.supplier.upsert({
    where: { cnpj: "00000000000000" },
    update: { nome: "Fornecedor de Teste A" },
    create: { nome: "Fornecedor de Teste A", cnpj: "00000000000000" }
  });

  const supplierB = await prisma.supplier.upsert({
    where: { cnpj: "11111111111111" },
    update: { nome: "Fornecedor de Teste B" },
    create: { nome: "Fornecedor de Teste B", cnpj: "11111111111111" }
  });

  const manager = await prisma.manager.upsert({
    where: { email: "gestor.teste@empresa.com" },
    update: {
      nome: "Gestor Teste",
      ativo: true,
      role: "GESTOR"
    },
    create: {
      nome: "Gestor Teste",
      email: "gestor.teste@empresa.com",
      senhaHash: hashPassword("123456"),
      role: "GESTOR",
      ativo: true
    }
  });

  await prisma.managerSupplier.upsert({
    where: {
      managerId_supplierId: {
        managerId: manager.id,
        supplierId: supplierA.id
      }
    },
    update: {},
    create: {
      managerId: manager.id,
      supplierId: supplierA.id
    }
  });

  await prisma.managerSupplier.upsert({
    where: {
      managerId_supplierId: {
        managerId: manager.id,
        supplierId: supplierB.id
      }
    },
    update: {},
    create: {
      managerId: manager.id,
      supplierId: supplierB.id
    }
  });

  await prisma.notificationRule.upsert({
    where: { id: "global-rule-seed" },
    update: {
      diasLembrete: 2,
      ativo: true,
      destinatarioAdicional: "financeiro@empresa.com"
    },
    create: {
      id: "global-rule-seed",
      diasLembrete: 2,
      ativo: true,
      destinatarioAdicional: "financeiro@empresa.com"
    }
  });

  await prisma.supplierNotificationConfig.upsert({
    where: { supplierId: supplierA.id },
    update: {
      ativo: true,
      recorrenciaDias: 2,
      maxTentativas: 2,
      emailsExtras: ["compras@empresa.com"]
    },
    create: {
      supplierId: supplierA.id,
      ativo: true,
      recorrenciaDias: 2,
      maxTentativas: 2,
      emailsExtras: ["compras@empresa.com"]
    }
  });

  await prisma.supplierNotificationConfig.upsert({
    where: { supplierId: supplierB.id },
    update: {
      ativo: true,
      recorrenciaDias: 3,
      maxTentativas: 3,
      emailsExtras: ["fiscal@empresa.com"]
    },
    create: {
      supplierId: supplierB.id,
      ativo: true,
      recorrenciaDias: 3,
      maxTentativas: 3,
      emailsExtras: ["fiscal@empresa.com"]
    }
  });

  // Notas de exemplo para visualização da tela
  await upsertInvoice({
    codigoIdentificador: "00000000000000000000000000000000000000000001",
    numeroNota: "NF-1001",
    fornecedorId: supplierA.id,
    status: "AGUARDANDO_APROVACAO",
    processada: false,
    statusProcessamento: "PENDENTE",
    tentativasNotificacao: 0,
    valorServico: "9500.00",
    valorLiquido: "9310.00"
  });

  await upsertInvoice({
    codigoIdentificador: "00000000000000000000000000000000000000000002",
    numeroNota: "NF-1002",
    fornecedorId: supplierA.id,
    status: "APROVADO",
    processada: false,
    statusProcessamento: "PROCESSANDO",
    tentativasNotificacao: 1,
    ultimoLembreteEm: new Date(),
    valorServico: "4200.00",
    valorLiquido: "4116.00"
  });

  await upsertInvoice({
    codigoIdentificador: "00000000000000000000000000000000000000000003",
    numeroNota: "NF-2001",
    fornecedorId: supplierA.id,
    status: "PROCESSADO",
    processada: true,
    statusProcessamento: "CONCLUIDO",
    tentativasNotificacao: 1,
    valorServico: "12000.00",
    valorLiquido: "11760.00"
  });

  await upsertInvoice({
    codigoIdentificador: "00000000000000000000000000000000000000000004",
    numeroNota: "NF-2002",
    fornecedorId: supplierA.id,
    status: "EXPIRADA",
    processada: true,
    statusProcessamento: "ERRO",
    tentativasNotificacao: 3,
    ultimoLembreteEm: new Date(),
    valorServico: "3000.00",
    valorLiquido: "2940.00"
  });

  console.log("Seed concluído com sucesso.");
  console.log("Usuário de teste:");
  console.log("email: gestor.teste@empresa.com");
  console.log("senha: 123456");
  console.log("Fornecedores vinculados ao gestor.teste@empresa.com: Fornecedor de Teste A e Fornecedor de Teste B");
  console.log("Notas de exemplo criadas e vinculadas ao gestor.teste@empresa.com: NF-1001, NF-1002, NF-2001, NF-2002");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
