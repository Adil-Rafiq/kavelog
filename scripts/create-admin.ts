/**
 * Create or upgrade an initial admin user.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <name> <password>
 *
 * If the user exists: their role is set to "admin" and status to "active".
 * If they don't exist: create them with the given password.
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { users } from "../src/db/schema";

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error(
      "Usage: npx tsx scripts/create-admin.ts <email> <name> <password>"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const lower = email.toLowerCase();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, lower))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        role: "admin",
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    console.log(`Upgraded existing user ${lower} to admin.`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    name,
    email: lower,
    passwordHash: hash,
    role: "admin",
    status: "active",
  });
  console.log(`Created admin ${lower}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
