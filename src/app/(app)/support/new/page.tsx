import { NewTicketForm } from "./new-ticket-form";

export default function NewTicketPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Support
        </span>
        <h1 className="text-2xl text-foreground">Open a new ticket</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For example: requesting a new department, reporting a bug, or asking a
          policy question.
        </p>
      </header>
      <NewTicketForm />
    </div>
  );
}
