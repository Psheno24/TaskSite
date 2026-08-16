/**
 * Create a teacher account in standalone Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/create-teacher.ts email@example.com 'password'
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
      "Usage: npx tsx scripts/create-teacher.ts <email> <password>"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.error(`User already exists: ${email}`);
    await client.end();
    process.exit(1);
  }

  const passwordHash = await hash(password, 12);
  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      role: "teacher",
    })
    .returning({ id: users.id, email: users.email });

  console.log("Teacher created:", created);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
