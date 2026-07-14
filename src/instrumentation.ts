/**
 * Cold-start hook. Durable schema lives on Turso — no local file init on Vercel.
 */
export async function register() {
  // no-op
}
