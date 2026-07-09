"use client";

import { useEffect } from "react";

const BLIP_SCRIPT_SRC = "https://unpkg.com/blip-chat-widget";
const BLIP_APP_KEY = "YXRlbmRpbWVudG9taW5hc21pbmVyYWNhbzplZTRiM2Y0My1hNDY0LTQzZTAtOGE3Ny05ODg3M2EyYTNlODg=";
const BLIP_COMMON_URL = "https://felipemconsultoria.chat.blip.ai/";

type BlipAccount = {
  fullName: string;
  email?: string;
  extras?: Record<string, string>;
};

type BlipChatBuilder = {
  withAppKey(appKey: string): BlipChatBuilder;
  withAccount(account: BlipAccount): BlipChatBuilder;
  withButton(config: { color: string; icon: string }): BlipChatBuilder;
  withCustomCommonUrl(url: string): BlipChatBuilder;
  build(): void;
  destroy?: () => void;
};

type BlipChatConstructor = new () => BlipChatBuilder;

type AuthMeResponse = {
  authenticated: boolean;
  manager?: {
    id: string;
    nome: string;
    email: string;
    role: string;
  };
};

declare global {
  interface Window {
    BlipChat?: BlipChatConstructor;
    __rpaBlipChat?: BlipChatBuilder;
  }
}

function loadBlipScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.BlipChat) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${BLIP_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Falha ao carregar o Blip Chat Widget.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = BLIP_SCRIPT_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o Blip Chat Widget."));
    document.body.appendChild(script);
  });
}

export function BlipChatWidget() {
  useEffect(() => {
    let isMounted = true;

    async function buildWidget() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) return;

        const data = (await response.json()) as AuthMeResponse;
        if (!data.authenticated || !data.manager || !isMounted) return;

        await loadBlipScript();
        if (!isMounted || !window.BlipChat || window.__rpaBlipChat) return;

        const blipClient = new window.BlipChat();
        blipClient
          .withAppKey(BLIP_APP_KEY)
          .withAccount({
            fullName: data.manager.nome,
            email: data.manager.email,
            extras: {
              managerId: data.manager.id,
              role: data.manager.role
            }
          })
          .withButton({ color: "#0096fa", icon: "" })
          .withCustomCommonUrl(BLIP_COMMON_URL)
          .build();

        window.__rpaBlipChat = blipClient;
      } catch {
        // O chat é um recurso complementar e não deve impedir o uso da área interna.
      }
    }

    buildWidget();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
