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
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;

    const verify = crypto.scryptSync(password, salt, 64).toString("hex");
    const hashBuffer = Buffer.from(hash, "hex");
    const verifyBuffer = Buffer.from(verify, "hex");

    if (hashBuffer.length !== verifyBuffer.length) return false;

    return crypto.timingSafeEqual(hashBuffer, verifyBuffer);
  } catch {
    return false;
  }
}

type SessionPayload = {
  managerId: string;
  role: "ADMIN" | "GESTOR" | "FORNECEDOR";
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
      managerSuppliers: {
        include: {
          supplier: true
        }
      }
    }
  });

  if (!manager || !manager.ativo) return null;

  return manager;
}

export function getAllowedSupplierIds(manager: NonNullable<Awaited<ReturnType<typeof getSessionManager>>>) {
  return manager.managerSuppliers.map((ms) => ms.supplierId);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
