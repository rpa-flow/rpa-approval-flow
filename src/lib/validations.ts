import { DelphiIntegrationStatus, InvoiceSituation, InvoiceStatus, ProcessingStatus, SupplierRiskLevel } from "@prisma/client";
import { z } from "zod";

const dateTimeStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const brazilianDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!brazilianDateMatch) return trimmed;

  const [, day, month, year] = brazilianDateMatch;
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber, 12));

  if (date.getUTCFullYear() !== yearNumber || date.getUTCMonth() !== monthNumber - 1 || date.getUTCDate() !== dayNumber) {
    return trimmed;
  }

  return date.toISOString();
}, z.string().datetime().nullable().optional());

export const createInvoiceSchema = z
  .object({
    numeroNota: z.string().min(1).optional(),
    fornecedorId: z.string().min(1).optional(),
    codigoIdentificador: z.string().regex(/^\d{44,50}$/).optional(),
    xml: z.string().min(20).optional(),
    nDfse: z.string().optional(),
    localEmissao: z.string().optional(),
    localPrestacao: z.string().optional(),
    municipioIncidencia: z.string().optional(),
    itemTributacaoNac: z.string().optional(),
    itemTributacaoMun: z.string().optional(),
    nbsDescricao: z.string().optional(),
    dataProcessamento: z.string().datetime().optional(),
    dataEmissao: z.string().datetime().optional(),
    dataCompetencia: z.string().datetime().optional(),
    prestadorCnpj: z.string().optional(),
    prestadorNome: z.string().optional(),
    prestadorEmail: z.string().email().optional(),
    tomadorCnpj: z.string().optional(),
    tomadorNome: z.string().optional(),
    tomadorEmail: z.string().email().optional(),
    valorBaseCalculo: z.number().optional(),
    valorIssqn: z.number().optional(),
    valorTotalRetido: z.number().optional(),
    valorLiquido: z.number().optional(),
    valorServico: z.number().optional(),
    aliquota: z.number().optional()
  })
  .refine((data) => Boolean(data.xml) || Boolean(data.numeroNota && (data.fornecedorId || data.prestadorNome || data.prestadorCnpj)), {
    message:
      "Informe XML da NFSe (recomendado) ou os campos manuais numeroNota + fornecedor/prestador."
  });

export const updateInvoiceSchema = z
  .object({
    numeroNota: z.string().min(1).optional(),
    status: z.nativeEnum(InvoiceStatus).optional(),
    processada: z.boolean().optional(),
    statusProcessamento: z.nativeEnum(ProcessingStatus).optional(),
    tentativasNotificacao: z.number().int().min(0).optional(),
    ultimoLembreteEm: dateTimeStringSchema,
    ordemCompra: z.string().trim().max(120).nullable().optional(),
    ocContrato: z.string().min(1).optional(),
    dataLancamentoDelphi: dateTimeStringSchema,
    dataPagamento: dateTimeStringSchema,
    codigoDelphi: z.string().min(1).nullable().optional(),
    statusIntegracaoDelphi: z.nativeEnum(DelphiIntegrationStatus).optional(),
    situacaoNotaFiscal: z.nativeEnum(InvoiceSituation).optional(),
    observacaoValidacao: z.string().max(500).nullable().optional(),
    reason: z.string().trim().max(500).optional(),
    serviceEvaluation: z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(5),
      riskLevel: z.nativeEnum(SupplierRiskLevel),
      qualifica: z.enum(["SIM", "NAO"]).optional()
    }).optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Informe ao menos um campo para atualizar."
  });

export const companySchema = z.object({
  cnpj: z.string().trim().regex(/^\d{14}$/, "Informe um CNPJ com 14 dígitos, somente números."),
  displayName: z.string().trim().min(2).max(120),
  active: z.boolean().optional()
});

export const supplierSchema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().regex(/^\d{14}$/).optional(),
  codigoExterno: z.string().trim().min(1).max(120).optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  managers: z.array(
    z.object({
      nome: z.string().min(2),
      email: z.string().trim().toLowerCase().email(),
      senha: z.string().min(6)
    })
  ).default([])
});

export const updateSupplierSchema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().regex(/^\d{14}$/).nullable().optional(),
  codigoExterno: z.string().trim().min(1).max(120).nullable().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  addManager: z.object({
    id: z.string().min(1).optional(),
    nome: z.string().min(2).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    senha: z.string().min(6).optional()
  }).refine((data) => Boolean(data.id || data.email), {
    message: "Informe o gestor existente ou o e-mail do novo gestor."
  }).optional()
});


const userRoleSchema = z.enum(["ADMIN", "GESTOR", "FORNECEDOR"]);

export const managerSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(6),
  role: userRoleSchema.default("GESTOR"),
  ativo: z.boolean().optional(),
  supplierIds: z.array(z.string().min(1)).default([])
});

export const updateManagerSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(6).optional().or(z.literal("")),
  role: userRoleSchema,
  ativo: z.boolean(),
  supplierIds: z.array(z.string().min(1)).default([])
});

export const supplierNotificationConfigSchema = z.object({
  ativo: z.boolean(),
  recorrenciaDias: z.number().int().min(1).max(90),
  emailsExtras: z.array(z.string().email()).default([])
});

export const approvalNotificationSchema = z.object({
  invoiceId: z.string().min(1).optional(),
  codigoIdentificador: z.string().regex(/^\d{44,50}$/).optional(),
  extraMessage: z.string().max(500).optional()
}).refine((d) => d.invoiceId || d.codigoIdentificador, {
  message: "Informe invoiceId ou codigoIdentificador."
});

export const testEmailSchema = z.object({
  destinatario: z.string().trim().email().optional(),
  assunto: z.string().trim().min(3).max(120).optional(),
  mensagem: z.string().trim().min(3).max(1000).optional()
});

export const notificationRuleSchema = z.object({
  diasLembrete: z.number().int().min(0).max(60),
  ativo: z.boolean(),
  destinatarioAdicional: z.string().email().nullable().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
});

export const activateAccountSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(6)
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(6)
});


export const supplierCategorySchema = z.object({
  nome: z.string().min(2),
  descricao: z.string().max(200).optional().nullable(),
  ativo: z.boolean().optional()
});
