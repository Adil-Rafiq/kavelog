import { Suspense } from "react";
import { LoginForm } from "./login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-10 flex flex-col items-start gap-1">
        <span className="wordmark text-3xl text-foreground">KaveLog</span>
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Sign in to continue
        </span>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href="/register"
          className="text-foreground underline underline-offset-4 hover:text-primary"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
