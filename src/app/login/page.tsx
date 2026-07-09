"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MinasLogoIcon } from "@/components/brand/minas-logo-icon";
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
        <div className="login-brand-mark">
          <MinasLogoIcon className="h-16 w-16" />
          <div>
            <p className="login-brand-eyebrow">Minas Mineração</p>
            <h1>Central de aprovação fiscal</h1>
          </div>
        </div>

        <div className="login-strata" aria-hidden="true">
          <span className="login-strata-layer login-strata-teal" />
          <span className="login-strata-layer login-strata-blue" />
          <span className="login-strata-layer login-strata-small" />
        </div>

        <div className="login-context-panel">
          <p className="login-context-label">Ambiente corporativo</p>
          <p className="login-context-title">RPA Approval Flow</p>
          <p className="login-context-copy">Validação de notas, responsáveis e rastreabilidade em um fluxo operacional único.</p>
        </div>

        <div className="login-brand-footer">
          <span>Acesso restrito</span>
          <span>Operação fiscal</span>
          <span>Auditoria ativa</span>
        </div>
      </section>

      <Card className="login-card">
        <CardHeader className="p-0 pb-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-md border border-border bg-surface-container-low">
              <MinasLogoIcon className="h-9 w-9" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-brand">Minas Mineração</p>
              <CardTitle className="text-2xl">Entrar no sistema</CardTitle>
            </div>
          </div>
          <CardDescription>Use suas credenciais corporativas para continuar.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormField label="E-mail">
              <Input
                type="email"
                placeholder="usuario@minasmineracao.com.br"
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
              {loading ? "Entrando..." : "Acessar sistema"}
            </Button>
          </form>
          <div className="mt-3 text-center text-sm">
            <Link className="font-semibold text-brand hover:underline" href="/recuperar-senha">
              Esqueci minha senha
            </Link>
          </div>
          {erro && <Alert className="mt-4" variant="destructive">{erro}</Alert>}
        </CardContent>
      </Card>
    </main>
  );
}
