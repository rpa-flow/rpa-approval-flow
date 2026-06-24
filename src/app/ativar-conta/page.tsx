"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui-kit";

function AtivarContaContent() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("As senhas informadas não conferem.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/ativar-conta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setError(payload?.error ?? "Não foi possível ativar a conta.");
      return;
    }

    setMessage("Conta ativada com sucesso. Você já pode acessar o sistema.");
    window.setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <main className="login-shell auth-centered-shell">
      <Card className="login-card">
        <CardHeader className="p-0 pb-5">
          <CardTitle className="text-2xl">Ativar conta</CardTitle>
          <CardDescription>Cadastre sua senha para liberar o acesso ao RPA Approval Flow.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormField label="Nova senha">
              <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </FormField>
            <FormField label="Confirmar senha">
              <Input type="password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </FormField>
            <Button type="submit" disabled={loading || !token} className="w-full">
              {loading ? "Ativando..." : "Ativar conta"}
            </Button>
          </form>
          {!token && <Alert className="mt-4" variant="destructive">Link de ativação não informado.</Alert>}
          {error && <Alert className="mt-4" variant="destructive">{error}</Alert>}
          {message && <Alert className="mt-4">{message}</Alert>}
        </CardContent>
      </Card>
    </main>
  );
}


export default function AtivarContaPage() {
  return (
    <Suspense fallback={<main className="login-shell auth-centered-shell"><Card className="login-card">Carregando...</Card></main>}>
      <AtivarContaContent />
    </Suspense>
  );
}
