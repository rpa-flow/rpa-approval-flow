"use client";

import { ReactNode } from "react";

export function ReportPageLayout({ title, filters, children }: { title: string; filters: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Análises</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
        </div>
      </div>
      <div className="card card-compact">{filters}</div>
      {children}
    </section>
  );
}

export function KpiCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <article className="card card-compact">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
    </article>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="card space-y-3">
      <div className="section-header !mb-0 !pb-3">
        <h3 className="section-title">{title}</h3>
      </div>
      {children}
    </article>
  );
}

export function ReportTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-shell">
      <table className="min-w-full text-sm">
        <thead>
          <tr>{headers.map((h) => <th className="px-4 py-3 text-left" key={h}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, idx) => (
            <tr key={idx}>{r.map((c, i) => <td key={i} className="px-4 py-3 text-slate-700">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const EmptyState = ({ text }: { text: string }) => <div className="empty-state text-sm">{text}</div>;
export const LoadingState = () => <div className="state-loading text-sm" role="status">Carregando informações do relatório...</div>;
export const ErrorState = ({ text }: { text: string }) => <div className="state-error text-sm" role="alert">{text}</div>;
export const StatusBadge = ({ status }: { status: string }) => <span className="badge badge-slate">{status}</span>;
export const RiskBadge = ({ risk }: { risk: string }) => <span className="badge badge-warning">{risk}</span>;
export const RatingDisplay = ({ value }: { value: number }) => <span className="font-semibold text-slate-800">{value.toFixed(1)} ★</span>;
