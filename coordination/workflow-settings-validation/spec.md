# Workflow settings validation and error visibility specification

## Goal and boundaries

- Goal: make NFS-e workflow configuration and approval fit the application's navigation and familiar approval experience.
- In scope: cross-step publication validation and checklist, accessible visible save/publish feedback, focused registration UX improvements, nested sidebar navigation for workflow settings, and dashboard approval using the current step's field policies.
- Out of scope: changing sequential approval semantics, field permission rules, persistence format, API contract, or database schema.
- Source / approval: initial validation and configuration UX approved and implemented; additional navigation/dashboard requirements requested on 2026-11-09; implementation approval for this added scope pending.

## Observed facts and open decisions

| Type | Item | Evidence or decision needed |
|---|---|---|
| Observed fact | Publication currently requires required editable `dataPagamento` and editable `ordemCompra` or `ocContrato` on the same step. | `src/lib/workflow/configuration.ts` |
| Observed fact | The settings page displays a single status paragraph before the tabbed sections, so it can leave the viewport while the administrator is editing lower steps. | `src/app/configuracoes/workflows/page.tsx` |
| User decision | Required payment date may be configured in one step and editable purchase order or contract in another. | User described date in step 1 and purchase data in step 2. |
| Observed fact | Workflow settings are linked from a card on `/configuracoes`; the sidebar currently has a flat Configurações link and no nested item. | `src/app/configuracoes/page.tsx`, `src/app/components/app-header.tsx` |
| Observed fact | Dashboard rows currently route active workflow items to a separate “Abrir etapa do workflow” page; non-workflow approvals use the established approval modal. | `src/app/dashboard/page.tsx`, `src/app/notas/[id]/workflow/page.tsx` |
| User decision | Approvers should experience the familiar dashboard approval flow; only editable fields should appear in the approval dialog, read-only information stays in note details, and approver-facing wording should not expose the internal workflow concept. | User request on 2026-11-09, clarified on 2026-11-09. |

## Domain

### Domain rules

- DR-1: A workflow is publishable when at least one step requires an editable payment date and at least one step enables the purchase requirement and exposes either `ordemCompra` or `ocContrato` as editable. These conditions may be satisfied by different steps.
- DR-2: Existing publication requirements remain: service evaluation is required in some step, and payment date remains editable in the final step.
- DR-3: The configuration checklist must express the cross-step requirements consistently with publication validation.
- DR-4: After save or publish failure, the administrator must be able to see the error without manually scrolling back to the top; the feedback must be announced accessibly.
- DR-5: The workflow registration interface should make the sequence of adding, configuring, ordering, and saving steps easier to follow, without changing permission or publication rules. Implement only focused improvements supported by the current flow; do not broaden into a full redesign.
- DR-6: Workflow settings must be reachable as a nested item under the sidebar's Configurações navigation, on desktop and mobile. Keep the parent Configurações destination available and show the child item only to administrators.
- DR-7: For an active approval task initiated from the dashboard, use the established approval dialog pattern. Display only fields configured as `EDITABLE` in the current step, honoring their required flags. `READ_ONLY` fields are shown as plain text only in the note details view; `HIDDEN` fields remain hidden. Preserve the established approval presentation for invoices without an active task.
- DR-8: Completing an active task from the dashboard must use the existing step-completion behavior so sequential assignment and final approval remain unchanged. Only the assigned approver may complete the task; server authorization remains authoritative.
- DR-9: The dashboard approval journey must use familiar approval language and must not show the internal term “workflow” to approvers.
- DR-10: “Ver detalhes” for a note with an active approval must use the established full-width invoice detail screen. Keep approval in the dashboard dialog; show visible configured values as plain text and do not expose hidden configured fields. Legacy `/notas/[id]/workflow` URLs redirect to the established detail screen.

## Acceptance scenarios

### AC-1: Publish configuration with payment and purchase data in separate steps

**Given** a valid workflow with a required editable payment date in step 1, and purchase requirement enabled with editable purchase order or contract in step 2

**When** the administrator publishes the draft

**Then** publication validation accepts these cross-step conditions

**And** all other publication requirements, including final-step payment-date editability and required service evaluation, still apply.

### AC-2: Keep the checklist aligned with publication validation

**Given** the payment and purchase requirements are satisfied across different steps

**When** the administrator reviews the publication checklist

**Then** the corresponding item is marked complete.

### AC-3: Keep action errors visible

**Given** the administrator is scrolled within workflow configuration

**When** saving or publishing fails

**Then** the error is brought into the visible page area and announced to assistive technology.

### AC-4: Make step registration easier to follow

**Given** the administrator is creating or editing a workflow draft

**When** they add and configure steps

**Then** the interface presents a clear, coherent sequence for entering step details and fields, with controls and guidance placed where they are needed

**And** reordering, copying a version, validation, and saving remain available without changing their behavior.

### AC-5: Navigate to workflow settings from the sidebar

**Given** an administrator is using the application on desktop or mobile

**When** they open the Configurações navigation group

**Then** they can open workflow settings through a nested menu item

**And** users without the ADMIN role do not see that item.

### AC-6: Approve an active task from the familiar dashboard dialog

**Given** an invoice has an active approval task assigned to the current approver

**When** the approver chooses the dashboard approval action

**Then** the established approval dialog opens instead of an internal workflow page

**And** only fields configured as editable in the current step appear in the dialog, with required behavior following their configured policies

**And** read-only fields appear as plain text in note details and hidden fields remain hidden

**And** confirmation completes the assigned step using existing sequential approval rules, without showing the term “workflow” to the approver.

### AC-7: Preserve non-workflow dashboard approval

**Given** an invoice has no active approval task

**When** an authorized user opens its approval dialog from the dashboard

**Then** the existing approval experience and behavior remain unchanged.

### AC-8: Keep the established note details layout for active approvals

**Given** a note has an active or blocked approval

**When** an authorized user chooses “Ver detalhes” or opens a legacy approval URL

**Then** the established full-width invoice details layout is displayed

**And** configured visible values are shown as text, hidden fields remain omitted, and approval actions stay in the dashboard.

## Error, authorization, and edge cases

- Missing payment-date requirement, missing purchase requirement/editable field, missing required evaluation, or a non-editable final payment date must continue to reject publication with actionable messages.
- Validation remains server-side authoritative; UI checklist is informational.
- If dashboard task metadata is stale or does not identify the current user's assignment, do not allow completion from client-side state; rely on the existing server response and refresh the invoice/task state.

## Technical decisions

| Decision | Chosen approach | Rationale | Consequence / migration |
|---|---|---|---|
| Cross-step validation | Evaluate payment and purchase conditions independently over all steps. | Matches the administrator's explicitly described configuration. | No schema or migration change. |
| Error visibility | Keep existing feedback channel, but make action errors reliably visible and programmatically announced. | Addresses the page-scroll problem without changing API behavior. | No API contract change. |
| Sidebar nesting | Extend the existing sidebar navigation model to support a Configurações child entry for admins on desktop and mobile. | Aligns access with the repository's navigation convention. | Preserve current routes; no migration. |
| Dashboard step approval | Reuse the established approval dialog presentation with current-step metadata; show only editable fields and post to the existing step-completion endpoint for active tasks. | Keeps the user experience familiar while retaining server-side sequencing and permissions. | Read-only values stay on the note details view; no API contract or schema change. Handle stale assignment responses with refresh/error feedback. |

## Implementation and verification plan

1. Update server publication validation and the settings checklist to recognize the cross-step configuration.
2. Review the current step-registration journey and make focused UX improvements to its flow and guidance.
3. Make save/publish errors remain visible when the user is scrolled and retain accessible status/error semantics.
4. Add or update focused validation checks for cross-step success and existing rejection conditions; run relevant focused checks and `git diff --check`.
5. Add nested Configurações navigation and verify ADMIN visibility/desktop/mobile behavior.
6. Adapt the dashboard approval dialog for active tasks using current-step field policies and existing completion endpoint; retain the existing non-task approval path.
7. Verify authorized and non-assigned dashboard behavior, required/read-only/hidden fields, sequential completion, and final approval; run focused checks and a production build.
8. Keep note details on the established full-width page for active approvals; verify hidden fields, blocked-resume handling, and legacy URL redirects.

## Risks, rollout, and deferred work

- Existing published versions are immutable and unaffected; this changes validation of drafts going forward.
