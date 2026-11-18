CREATE TYPE "WorkflowResponsibilityMode" AS ENUM ('SUPPLIER_MANAGERS', 'SELECTED_USERS');

ALTER TABLE "ApprovalWorkflowStep"
ADD COLUMN "responsibilityMode" "WorkflowResponsibilityMode" NOT NULL DEFAULT 'SELECTED_USERS';

CREATE TABLE "ApprovalWorkflowStepManager" (
    "stepId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    CONSTRAINT "ApprovalWorkflowStepManager_pkey" PRIMARY KEY ("stepId", "managerId")
);

INSERT INTO "ApprovalWorkflowStepManager" ("stepId", "managerId")
SELECT "id", "managerId" FROM "ApprovalWorkflowStep";

DROP INDEX "ApprovalWorkflowStep_managerId_idx";
ALTER TABLE "ApprovalWorkflowStep" DROP CONSTRAINT "ApprovalWorkflowStep_managerId_fkey";
ALTER TABLE "ApprovalWorkflowStep" DROP COLUMN "managerId";

CREATE INDEX "ApprovalWorkflowStepManager_managerId_idx" ON "ApprovalWorkflowStepManager"("managerId");
ALTER TABLE "ApprovalWorkflowStepManager"
ADD CONSTRAINT "ApprovalWorkflowStepManager_stepId_fkey"
FOREIGN KEY ("stepId") REFERENCES "ApprovalWorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalWorkflowStepManager"
ADD CONSTRAINT "ApprovalWorkflowStepManager_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "InvoiceWorkflowTask_executionId_stepId_key";
CREATE UNIQUE INDEX "InvoiceWorkflowTask_executionId_stepId_managerId_key"
ON "InvoiceWorkflowTask"("executionId", "stepId", "managerId");

