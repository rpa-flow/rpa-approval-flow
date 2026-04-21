"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });

    if (!res.ok) {
      setErro("Falha no login. Verifique e-mail e senha.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="container">
      <section className="card">
        <h1>Login do Gestor</h1>
        <form onSubmit={onSubmit} className="form-grid">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <button type="submit">Entrar</button>
        </form>
        {erro && <p className="message">{erro}</p>}
      </section>
    </main>
  );
}
