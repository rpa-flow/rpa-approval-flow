import { InvoiceStatus, ProcessingStatus } from "@prisma/client";
import { z } from "zod";

export const createInvoiceSchema = z
  .object({
    numeroNota: z.string().min(1).optional(),
    fornecedorId: z.string().min(1).optional(),
    codigoIdentificador: z.string().regex(/^\d{44}$/).optional(),
    xml: z.string().min(20).optional()
  })
  .refine((data) => Boolean(data.xml) || Boolean(data.fornecedorId && data.numeroNota), {
    message:
      "Informe XML da NFSe (recomendado) ou os campos manuais fornecedorId + numeroNota."
  });

export const updateInvoiceSchema = z
  .object({
    numeroNota: z.string().min(1).optional(),
    status: z.nativeEnum(InvoiceStatus).optional(),
    processada: z.boolean().optional(),
    statusProcessamento: z.nativeEnum(ProcessingStatus).optional(),
    tentativasNotificacao: z.number().int().min(0).optional(),
    ultimoLembreteEm: z.string().datetime().nullable().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Informe ao menos um campo para atualizar."
  });

export const supplierSchema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().regex(/^\d{14}$/).optional(),
  managers: z.array(
    z.object({
      nome: z.string().min(2),
      email: z.string().email(),
      senha: z.string().min(6)
    })
  )
});

export const updateSupplierSchema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().regex(/^\d{14}$/).nullable().optional(),
  addManager: z.object({
    nome: z.string().min(2).optional(),
    email: z.string().email(),
    senha: z.string().min(6).optional()
  }).optional()
});

export const supplierNotificationConfigSchema = z.object({
  ativo: z.boolean(),
  recorrenciaDias: z.number().int().min(1).max(90),
  maxTentativas: z.number().int().min(1).max(10),
  emailsExtras: z.array(z.string().email()).default([])
});

export const approvalNotificationSchema = z.object({
  invoiceId: z.string().min(1).optional(),
  codigoIdentificador: z.string().regex(/^\d{44}$/).optional(),
  extraMessage: z.string().max(500).optional()
}).refine((d) => d.invoiceId || d.codigoIdentificador, {
  message: "Informe invoiceId ou codigoIdentificador."
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
