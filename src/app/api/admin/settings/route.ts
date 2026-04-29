import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const openRegistration = await getSetting(SETTING_KEYS.OPEN_REGISTRATION);
  return NextResponse.json({
    openRegistration: openRegistration === "true",
  });
}

const schema = z.object({
  openRegistration: z.boolean(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await setSetting(
    SETTING_KEYS.OPEN_REGISTRATION,
    parsed.data.openRegistration ? "true" : "false"
  );
  return NextResponse.json({ ok: true });
}
