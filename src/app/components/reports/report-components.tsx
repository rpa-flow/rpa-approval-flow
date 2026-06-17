"use client";

import { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState as KitEmptyState, LoadingState as KitLoadingState, SectionCard } from "@/components/ui-kit";

export function ReportPageLayout({ title, filters, children }: { title: string; filters: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-brand">Análises</p>
          <h2 className="text-2xl font-semibold text-text">{title}</h2>
        </div>
      </div>
      <Card><CardContent className="pt-5 sm:pt-6">{filters}</CardContent></Card>
      {children}
    </section>
  );
}

export function KpiCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Card>
      <CardContent className="pt-5 sm:pt-6">
        <p className="text-xs font-bold uppercase text-muted">{title}</p>
        <p className="mt-2 text-3xl font-semibold text-text">{value}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
      </CardContent>
    </Card>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <SectionCard title={title}>{children}</SectionCard>;
}

export function ReportTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-container-lowest shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map((r, idx) => <TableRow key={idx}>{r.map((c, i) => <TableCell key={i} className="text-muted">{c}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
      </div>
    </div>
  );
}

export const EmptyState = ({ text }: { text: string }) => <KitEmptyState title={text} />;
export const LoadingState = () => <KitLoadingState />;
export const ErrorState = ({ text }: { text: string }) => <Alert variant="destructive">{text}</Alert>;
export const StatusBadge = ({ status }: { status: string }) => <Badge variant="secondary">{status}</Badge>;
export const RiskBadge = ({ risk }: { risk: string }) => <Badge variant="warning">{risk}</Badge>;
export const RatingDisplay = ({ value }: { value: number }) => <span className="font-semibold text-text">{value.toFixed(1)} ★</span>;
