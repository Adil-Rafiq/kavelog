import { db } from "@/db/client";
import { notifications, type NewNotification } from "@/db/schema";

export async function notify(input: Omit<NewNotification, "id" | "createdAt">) {
  await db.insert(notifications).values(input);
}
