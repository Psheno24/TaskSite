export type DataProvider = "supabase" | "postgres";

/** Default stays `supabase` so production is unchanged until you switch. */
export function getDataProvider(): DataProvider {
  const value = process.env.DATA_PROVIDER?.trim().toLowerCase();
  if (value === "postgres") return "postgres";
  return "supabase";
}

export function isPostgresProvider(): boolean {
  return getDataProvider() === "postgres";
}
