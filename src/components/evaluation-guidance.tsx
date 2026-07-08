export const RATING_SCALE = [
  { value: 1, label: "Muito Insatisfeito" },
  { value: 2, label: "Insatisfeito" },
  { value: 3, label: "Regular" },
  { value: 4, label: "Satisfeito" },
  { value: 5, label: "Muito Satisfeito" }
] as const;

export const QUALIFICA_HELP_TEXT = "Legenda: Sim = mantém fornecedor para novas contratações";

export const QUALIFICATION_PROCEDURE_HREF = "/procedimentos/Qualificacao%20e%20Desenvolvimento%20do%20Fornecedor%20Rev1.pdf";

export function getRatingLabel(value: number) {
  return RATING_SCALE.find((item) => item.value === value)?.label ?? "";
}

export function RatingScaleHint({ id }: { id: string }) {
  return <div id={id} className="rounded-md border border-border bg-surface-container-low px-3 py-2 text-xs leading-5 text-muted">
    <span className="font-semibold text-text">Escala:</span>{" "}
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
      {RATING_SCALE.map((item) => <span key={item.value} className="whitespace-nowrap">
        <strong className="text-brand">{item.value}</strong> - {item.label}
      </span>)}
    </span>
  </div>;
}

export function QualificaHelpText({ id }: { id: string }) {
  return <span id={id} className="text-xs leading-5 text-muted">{QUALIFICA_HELP_TEXT}</span>;
}

export function QualificationProcedureLink() {
  return <a
    href={QUALIFICATION_PROCEDURE_HREF}
    target="_blank"
    rel="noreferrer"
    className="inline-flex max-w-full text-xs font-semibold leading-5 text-brand underline decoration-brand/30 underline-offset-4 transition hover:text-brand-strong"
  >
    Consultar procedimento de qualificação e desenvolvimento de fornecedores
  </a>;
}
