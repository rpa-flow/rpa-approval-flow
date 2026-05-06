"use client";

import { useState } from "react";
import { MainHeader } from "@/app/components/main-header";

export default function PerfilPage() {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [message, setMessage] = useState("");

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage("A confirmação da nova senha não confere.");
      return;
    }

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setMessage(payload?.error ?? "Erro ao alterar senha.");
      return;
    }

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setMessage("Senha alterada com sucesso.");
  }

  return (
    <main className="container container-wide">
      <MainHeader
        title="Perfil"
        subtitle="Gerencie dados da sua conta."
      />

      <section className="card">
        <h2>Alterar minha senha</h2>
        <p className="muted small">Atualize sua senha de acesso com segurança.</p>
        <form onSubmit={alterarSenha} className="form-grid">
          <label>
            Senha atual
            <input
              required
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
            />
          </label>
          <label>
            Nova senha
            <input
              required
              minLength={6}
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
            />
          </label>
          <label>
            Confirmar nova senha
            <input
              required
              minLength={6}
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            />
          </label>
          <button type="submit">Alterar senha</button>
        </form>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
