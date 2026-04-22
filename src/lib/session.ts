import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "session";
const SESSION_DURATION_SEC = 60 * 60 * 24 * 7; // 7 days

const rawSecret = process.env.SESSION_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error("SESSION_SECRET must be set and at least 32 characters");
}
const secret = new TextEncoder().encode(rawSecret);

type SessionPayload = { userId: string };

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SEC,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// Used by proxy.ts (Edge runtime) — verify only, no cookies API
export async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return { userId: String(payload.userId) };
  } catch {
    return null;
  }
}
