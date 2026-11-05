-- CreateEnum
CREATE TYPE "WorkflowDocumentType" AS ENUM ('NFSE');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "WorkflowFieldMode" AS ENUM ('HIDDEN', 'READ_ONLY', 'EDITABLE');

-- CreateEnum
CREATE TYPE "WorkflowConsultationScope" AS ENUM ('ASSIGNED', 'ALL');

-- CreateEnum
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "WorkflowNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'FAILED', 'UNCERTAIN', 'SIMULATED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "descricaoServico" TEXT,
ADD COLUMN     "documentType" "WorkflowDocumentType";

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "documentType" "WorkflowDocumentType" NOT NULL,
    "activeVersionId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflowStep" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "managerId" TEXT NOT NULL,
    "consultationScope" "WorkflowConsultationScope" NOT NULL DEFAULT 'ASSIGNED',
    "requiresPurchaseOrder" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ApprovalWorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStepFieldPolicy" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "mode" "WorkflowFieldMode" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ApprovalStepFieldPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceWorkflow" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InvoiceWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceWorkflowTask" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "managerEmail" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InvoiceWorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowCommand" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowConfigurationAudit" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowConfigurationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNotification" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNotificationAttempt" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "status" "WorkflowNotificationStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowNotificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_documentType_key" ON "ApprovalWorkflow"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_activeVersionId_key" ON "ApprovalWorkflow"("activeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflowVersion_workflowId_number_key" ON "ApprovalWorkflowVersion"("workflowId", "number");

-- CreateIndex
CREATE INDEX "ApprovalWorkflowStep_managerId_idx" ON "ApprovalWorkflowStep"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflowStep_versionId_position_key" ON "ApprovalWorkflowStep"("versionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStepFieldPolicy_stepId_fieldKey_key" ON "ApprovalStepFieldPolicy"("stepId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceWorkflow_invoiceId_key" ON "InvoiceWorkflow"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceWorkflow_status_createdAt_idx" ON "InvoiceWorkflow"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceWorkflowTask_managerId_completedAt_idx" ON "InvoiceWorkflowTask"("managerId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceWorkflowTask_executionId_stepId_key" ON "InvoiceWorkflowTask"("executionId", "stepId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowCommand_executionId_idempotencyKey_key" ON "WorkflowCommand"("executionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkflowConfigurationAudit_workflowId_createdAt_idx" ON "WorkflowConfigurationAudit"("workflowId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNotification_deduplicationKey_key" ON "WorkflowNotification"("deduplicationKey");

-- CreateIndex
CREATE INDEX "WorkflowNotification_status_availableAt_idx" ON "WorkflowNotification"("status", "availableAt");

-- CreateIndex
CREATE INDEX "WorkflowNotificationAttempt_notificationId_createdAt_idx" ON "WorkflowNotificationAttempt"("notificationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "ApprovalWorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowVersion" ADD CONSTRAINT "ApprovalWorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowStep" ADD CONSTRAINT "ApprovalWorkflowStep_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ApprovalWorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowStep" ADD CONSTRAINT "ApprovalWorkflowStep_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepFieldPolicy" ADD CONSTRAINT "ApprovalStepFieldPolicy_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalWorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceWorkflow" ADD CONSTRAINT "InvoiceWorkflow_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceWorkflow" ADD CONSTRAINT "InvoiceWorkflow_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ApprovalWorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceWorkflowTask" ADD CONSTRAINT "InvoiceWorkflowTask_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "InvoiceWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceWorkflowTask" ADD CONSTRAINT "InvoiceWorkflowTask_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalWorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceWorkflowTask" ADD CONSTRAINT "InvoiceWorkflowTask_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowCommand" ADD CONSTRAINT "WorkflowCommand_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "InvoiceWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "InvoiceWorkflowTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNotificationAttempt" ADD CONSTRAINT "WorkflowNotificationAttempt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "WorkflowNotification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

