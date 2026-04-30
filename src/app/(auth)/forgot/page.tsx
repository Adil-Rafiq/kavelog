import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPage() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-10 flex flex-col items-start gap-1">
        <span className="wordmark text-3xl text-foreground">KaveLog</span>
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Reset your password
        </span>
      </div>
      <ForgotForm />
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="text-foreground underline underline-offset-4 hover:text-primary"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
