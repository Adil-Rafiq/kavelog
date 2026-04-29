import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — used by middleware. Does NOT import the database
 * (which uses Node.js APIs incompatible with the Edge runtime).
 *
 * The full config (with the Credentials provider that hits the DB) lives in
 * src/auth.ts and is used in API routes / server components.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "employee";
        session.user.status = token.status as "pending" | "active" | "rejected";
        session.user.departmentId = token.departmentId as string | null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
