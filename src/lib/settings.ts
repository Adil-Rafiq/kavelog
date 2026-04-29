import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings, SETTING_KEYS } from "@/db/schema";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function isOpenRegistration(): Promise<boolean> {
  const v = await getSetting(SETTING_KEYS.OPEN_REGISTRATION);
  return v === "true";
}
