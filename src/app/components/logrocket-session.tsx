"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type LogRocketRequest = {
  reqId: string;
  url: string;
  headers: Record<string, string | null | undefined>;
  body?: string;
  method: string;
  referrer?: string;
  mode?: string;
  credentials?: string;
};

type LogRocketResponse = {
  reqId: string;
  status?: number;
  headers: Record<string, string | null | undefined>;
  body?: string;
  method: string;
  url?: string;
};

const appId = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;
const enabled = process.env.NEXT_PUBLIC_LOGROCKET_ENABLED === "true";
let initialized = false;
let activeUserId: string | null = null;
let initialization: Promise<void> | null = null;

function sanitizePageUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/(\/notas\/)[^/]+/g, "$1[id]");
    return parsed.toString();
  } catch {
    return "";
  }
}

function sanitizeRequest(request: LogRocketRequest) {
  const url = sanitizeNetworkUrl(request.url);
  if (!url) return null;
  return { ...request, url, headers: {}, body: null, referrer: null, credentials: null };
}

function sanitizeResponse(response: LogRocketResponse) {
  const url = response.url ? sanitizeNetworkUrl(response.url) : undefined;
  if (response.url && !url) return null;
  return { ...response, url, headers: {}, body: null };
}

function sanitizeNetworkUrl(url: string) {
  const sanitized = sanitizePageUrl(url);
  if (!sanitized || new URL(sanitized).origin !== window.location.origin) return null;

  const parsed = new URL(sanitized);
  parsed.pathname = parsed.pathname.replace(/^\/api\/.*$/, "/api/[redacted]");
  return parsed.toString();
}

async function startRecording() {
  if (!enabled || !appId || process.env.NODE_ENV !== "production") return;
  if (initialized) {
    const response = await fetch("/api/observability/logrocket", { cache: "no-store" });
    if (!response.ok) {
      window.location.replace("/login");
      return;
    }
    const identity: { enabled: boolean; userId?: string } = await response.json();
    if (!identity.enabled || !identity.userId) {
      window.location.replace("/login");
      return;
    }
    if (identity.userId !== activeUserId) {
      const { default: LogRocket } = await import("logrocket");
      LogRocket.startNewSession();
      LogRocket.identify(identity.userId);
      activeUserId = identity.userId;
    }
    return;
  }
  if (!initialization) {
    initialization = (async () => {
      const response = await fetch("/api/observability/logrocket", { cache: "no-store" });
      if (!response.ok) {
        initialization = null;
        return;
      }
      const identity: { enabled: boolean; userId?: string } = await response.json();
      if (!identity.enabled || !identity.userId) {
        initialization = null;
        return;
      }

      const { default: LogRocket } = await import("logrocket");
      LogRocket.init(appId, {
        dom: { inputSanitizer: true, textSanitizer: true, imageSanitizer: true },
        browser: { urlSanitizer: sanitizePageUrl },
        network: { requestSanitizer: sanitizeRequest, responseSanitizer: sanitizeResponse },
        console: { isEnabled: false },
        shouldDebugLog: false
      });
      LogRocket.identify(identity.userId);
      activeUserId = identity.userId;
      initialized = true;
    })().catch(() => {
      initialization = null;
    });
  }
  await initialization;
}

export default function LogRocketSession() {
  const pathname = usePathname();

  useEffect(() => {
    void startRecording();
  }, [pathname]);

  return null;
}
