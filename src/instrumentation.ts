/**
 * Cold-start hook. Durable schema lives on Turso — push via `npm run db:push:turso`.
 * Also self-heals critical columns Vercel builds skip (no migrate step).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  try {
    const { ensureTursoSchema } = await import("@/lib/ensure-schema");
    await ensureTursoSchema();
  } catch (err) {
    console.error("[instrumentation] ensureTursoSchema failed:", err);
  }
}
