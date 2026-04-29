import Link from "next/link";
import { db } from "@/db/client";
import { departments } from "@/db/schema";
import { asc } from "drizzle-orm";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const depts = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .orderBy(asc(departments.name));

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-10 flex flex-col items-start gap-1">
        <span className="wordmark text-3xl text-foreground">KaveLog</span>
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Create an account
        </span>
      </div>
      <RegisterForm departments={depts} />
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground underline underline-offset-4 hover:text-primary"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
