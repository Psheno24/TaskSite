/**
 * Reset teacher password in standalone Postgres.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/reset-teacher-password.ts email@example.com 'new-password'
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { users } from "../src/lib/db/schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!email || !password) {
    console.error(
      "Usage: npx tsx scripts/reset-teacher-password.ts <email> <password>"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  const passwordHash = await hash(password, 12);

  const updated = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email });

  if (updated.length === 0) {
    console.error(`User not found: ${email}`);
    await client.end();
    process.exit(1);
  }

  console.log("Password updated for:", updated[0]);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
