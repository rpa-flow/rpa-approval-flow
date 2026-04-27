/* eslint-disable no-console */
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const dados = require("./dados.json");
const senhas = require("./gestores.json");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("Iniciando seed...");

  // admin fixo
  await prisma.manager.upsert({
    where: { email: "admin@empresa.com" },
    update: {},
    create: {
      nome: "Administrador",
      email: "admin@empresa.com",
      senhaHash: hashPassword("admin123"),
      role: "ADMIN",
      ativo: true
    }
  });

  for (const item of dados) {
    const supplier = await prisma.supplier.upsert({
      where: { cnpj: item.cnpj },
      update: { nome: item.fornecedor },
      create: {
        nome: item.fornecedor,
        cnpj: item.cnpj
      }
    });

    const senha = senhas[item.gestor.email];

    const manager = await prisma.manager.upsert({
      where: { email: item.gestor.email },
      update: {
        nome: item.gestor.nome,
        ativo: true
      },
      create: {
        nome: item.gestor.nome,
        email: item.gestor.email,
        senhaHash: hashPassword(senha),
        role: "GESTOR",
        ativo: true
      }
    });

    await prisma.managerSupplier.upsert({
      where: {
        managerId_supplierId: {
          managerId: manager.id,
          supplierId: supplier.id
        }
      },
      update: {},
      create: {
        managerId: manager.id,
        supplierId: supplier.id
      }
    });
  }

  console.log("✔ seed concluído");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());