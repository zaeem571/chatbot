import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/session";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_ROUTES.some((p) => pathname.startsWith(p));

  const token = req.cookies.get("session")?.value;
  const session = token ? await verifyToken(token) : null;

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isPublic && session) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
