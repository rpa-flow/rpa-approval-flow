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
  const supplier = await prisma.supplier.upsert({
    where: { cnpj: "00000000000000" },
    update: { nome: "Fornecedor de Teste" },
    create: {
      nome: "Fornecedor de Teste",
      cnpj: "00000000000000"
    }
  });

  await prisma.manager.upsert({
    where: { email: "gestor.teste@empresa.com" },
    update: {
      nome: "Gestor Teste",
      supplierId: supplier.id,
      ativo: true,
      role: "GESTOR"
    },
    create: {
      nome: "Gestor Teste",
      email: "gestor.teste@empresa.com",
      senhaHash: hashPassword("123456"),
      supplierId: supplier.id,
      role: "GESTOR",
      ativo: true
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
    where: { supplierId: supplier.id },
    update: {
      ativo: true,
      recorrenciaDias: 2,
      emailsExtras: ["compras@empresa.com"]
    },
    create: {
      supplierId: supplier.id,
      ativo: true,
      recorrenciaDias: 2,
      emailsExtras: ["compras@empresa.com"]
    }
  });

  console.log("Seed concluído com sucesso.");
  console.log("Usuário de teste:");
  console.log("email: gestor.teste@empresa.com");
  console.log("senha: 123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
