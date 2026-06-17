import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const PUBLIC_PATHS = ["/login", "/register", "/forgot", "/reset", "/api/auth", "/_next", "/favicon.ico"];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("from", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const status = req.auth?.user?.status;
  const role = req.auth?.user?.role;

  if (status !== "active" && !nextUrl.pathname.startsWith("/pending")) {
    return NextResponse.redirect(new URL("/pending", nextUrl));
  }
  if (status === "active" && nextUrl.pathname === "/pending") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (nextUrl.pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Skip Next internals, the favicon, and all public PWA assets (manifest,
  // icons, service worker, offline page) so they're reachable without auth —
  // the browser fetches these before login and the SW must serve as JS.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|icons/|manifest.webmanifest|sw.js|offline.html).*)",
  ],
};
