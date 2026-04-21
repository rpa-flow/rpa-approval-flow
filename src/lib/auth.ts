import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "rpa_session";
const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  const verify = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verify, "hex"));
}

type SessionPayload = {
  managerId: string;
  role: "ADMIN" | "GESTOR";
  exp: number;
};

export function signSession(payload: Omit<SessionPayload, "exp">, ttlSeconds = 60 * 60 * 12) {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };

  const base = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(base).digest("base64url");
  return `${base}.${signature}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [base, signature] = token.split(".");
  if (!base || !signature) return null;

  const expected = crypto.createHmac("sha256", SECRET).update(base).digest("base64url");
  if (expected !== signature) return null;

  const payload = JSON.parse(Buffer.from(base, "base64url").toString()) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export async function getSessionManager() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySession(token);
  if (!session) return null;

  const manager = await prisma.manager.findUnique({
    where: { id: session.managerId },
    include: {
      supplier: true
    }
  });

  if (!manager || !manager.ativo) return null;

  return manager;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
