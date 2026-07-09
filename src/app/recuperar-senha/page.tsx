"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui-kit";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const res = await fetch("/api/auth/recuperar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    setLoading(false);
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      setError(payload?.error ?? "Não foi possível solicitar a recuperação de senha.");
      return;
    }

    setMessage(payload?.message ?? "Se o e-mail estiver cadastrado e ativo, enviaremos as instruções.");
  }

  return (
    <main className="login-shell auth-centered-shell">
      <Card className="login-card">
        <CardHeader className="p-0 pb-5">
          <CardTitle className="text-2xl">Recuperar senha</CardTitle>
          <CardDescription>Informe seu e-mail corporativo para receber um link de redefinição.</CardDescription>
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
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando..." : "Enviar instruções"}
            </Button>
          </form>
          {error && <Alert className="mt-4" variant="destructive">{error}</Alert>}
          {message && <Alert className="mt-4">{message}</Alert>}
        </CardContent>
      </Card>
    </main>
  );
}
