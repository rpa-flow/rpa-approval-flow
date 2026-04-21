/* eslint-disable no-console */
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
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

  console.log("Seed concluído com sucesso.");
  console.log("Usuário de teste:");
  console.log("email: gestor.teste@empresa.com");
  console.log("senha: 123456");
  console.log("Fornecedores vinculados: Fornecedor de Teste A e Fornecedor de Teste B");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
