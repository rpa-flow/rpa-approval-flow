"use client";

import { useState } from "react";
import { MainHeader } from "@/app/components/main-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppLayout, FormField } from "@/components/ui-kit";

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
    <AppLayout>
      <MainHeader
        title="Perfil"
        subtitle="Gerencie dados da sua conta."
      />

      <section className="profile-password-section">
        <Card className="profile-password-card">
          <CardHeader className="p-0 pb-5 text-center">
            <CardTitle className="text-2xl">Alterar minha senha</CardTitle>
            <CardDescription>Atualize sua senha de acesso com segurança.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <form onSubmit={alterarSenha} className="grid gap-4">
              <FormField label="Senha atual">
                <Input
                  required
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                />
              </FormField>
              <FormField label="Nova senha" description="Use pelo menos 6 caracteres.">
                <Input
                  required
                  minLength={6}
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                />
              </FormField>
              <FormField label="Confirmar nova senha">
                <Input
                  required
                  minLength={6}
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </FormField>
              <Button type="submit" className="w-full">Alterar senha</Button>
            </form>
            {message && <Alert className="mt-4" role="status">{message}</Alert>}
          </CardContent>
        </Card>
      </section>
    </AppLayout>
  );
}
