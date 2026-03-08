// proxy.ts — Edge Middleware untuk Next.js 16
// PENTING: file ini harus 100% self-contained, TIDAK boleh import dari lib/auth/session.ts
// karena session.ts punya "/// <reference types="node" />" yang akan menarik Node.js runtime

export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "eskahade_session";

function base64urlDecode(data: string): string {
  const padded = data + "==".slice((data.length + 3) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

async function verifySession(cookieHeader: string, secret: string): Promise<boolean> {
  try {
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    if (!match) return false;

    const token = match[1];
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return false;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = Uint8Array.from(
      base64urlDecode(sig).split("").map((c) => c.charCodeAt(0))
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(`${header}.${body}`)
    );

    if (!valid) return false;

    const payload = JSON.parse(base64urlDecode(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieHeader = request.headers.get("cookie") || "";
  const secret = process.env.JWT_SECRET || "";

  if (pathname.startsWith("/dashboard")) {
    const isValid = secret ? await verifySession(cookieHeader, secret) : false;
    if (!isValid) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname === "/login") {
    const isValid = secret ? await verifySession(cookieHeader, secret) : false;
    if (isValid) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};