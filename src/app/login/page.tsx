"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui-kit";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });

    setLoading(false);

    if (!res.ok) {
      setErro("Falha no login. Verifique e-mail e senha.");
      return;
    }

    const redirectTo = new URLSearchParams(window.location.search).get("redirect");
    router.push(redirectTo?.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded bg-white/10 ring-1 ring-white/20">
          <ShieldCheck size={28} />
        </div>
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase text-surface-container-low"><Sparkles size={14} /> Plataforma de aprovação</p>
        <h1>RPA Approval Flow</h1>
        <p>
          Plataforma para aprovação de notas fiscais com gestão de lembretes, histórico de
          recorrência e controle por fornecedor.
        </p>
        <ul>
          <li><CheckCircle2 size={16} /> Dashboard de aprovação por status</li>
          <li><CheckCircle2 size={16} /> Regras por fornecedor e lembretes recorrentes</li>
          <li><CheckCircle2 size={16} /> Controle de acesso por gestor</li>
        </ul>
      </section>

      <Card className="login-card">
        <CardHeader className="p-0 pb-5">
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription>Use suas credenciais de gestor para continuar.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormField label="E-mail">
              <Input
                type="email"
                placeholder="gestor@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Senha">
              <Input
                type="password"
                placeholder="********"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </FormField>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          {erro && <Alert className="mt-4" variant="destructive">{erro}</Alert>}
        </CardContent>
      </Card>
    </main>
  );
}
