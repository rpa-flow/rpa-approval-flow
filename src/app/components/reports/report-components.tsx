"use client";

import { ReactNode } from "react";

export function ReportPageLayout({ title, filters, children }: { title: string; filters: ReactNode; children: ReactNode }) {
  return <section className="space-y-4"><h2 className="text-2xl font-semibold">{title}</h2><div className="card">{filters}</div>{children}</section>;
}
export function KpiCard({ title, value, description }: { title: string; value: string; description: string }) {
  return <article className="card"><p className="text-xs text-slate-500">{title}</p><p className="text-2xl font-bold">{value}</p><p className="text-xs text-slate-500">{description}</p></article>;
}
export function ChartCard({ title, children }: { title: string; children: ReactNode }) { return <article className="card"><h3 className="font-semibold mb-2">{title}</h3>{children}</article>; }
export function ReportTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return <div className="overflow-auto"><table className="min-w-full text-sm"><thead><tr>{headers.map((h) => <th className="px-3 py-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, idx) => <tr key={idx} className="border-t">{r.map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr>)}</tbody></table></div>; }
export const EmptyState = ({ text }: { text: string }) => <p className="text-sm text-slate-500">{text}</p>;
export const LoadingState = () => <p className="text-sm">Carregando...</p>;
export const ErrorState = ({ text }: { text: string }) => <p className="text-sm text-rose-600">{text}</p>;
export const StatusBadge = ({ status }: { status: string }) => <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{status}</span>;
export const RiskBadge = ({ risk }: { risk: string }) => <span className="rounded-full bg-amber-100 px-2 py-1 text-xs">{risk}</span>;
export const RatingDisplay = ({ value }: { value: number }) => <span>{value.toFixed(1)} ★</span>;
