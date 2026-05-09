"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <h1>RPA Approval Flow</h1>
        <p>
          Plataforma para aprovação de notas fiscais com gestão de lembretes, histórico de
          tentativas e controle por fornecedor.
        </p>
        <ul>
          <li>✅ Dashboard de aprovação por status</li>
          <li>✅ Regras por fornecedor e tentativas de lembrete</li>
          <li>✅ Controle de acesso por gestor</li>
        </ul>
      </section>

      <section className="login-card">
        <h2>Entrar</h2>
        <p className="muted">Use suas credenciais de gestor para continuar.</p>
        <form onSubmit={onSubmit} className="form-grid">
          <label>
            E-mail
            <input
              type="email"
              placeholder="gestor@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              placeholder="********"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </label>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        {erro && <p className="login-error">{erro}</p>}
      </section>
    </main>
  );
}
