import type { Metadata } from "next";
import LogRocketSession from "@/app/components/logrocket-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluxo de Aprovação de Notas",
  description: "Painel para gestão de fornecedores, gestores e regras de aviso"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <LogRocketSession />
        {children}
      </body>
    </html>
  );
}
