// SEAM (phase 04): voting is anonymous, so the session is always null for now.
// Phase 05 replaces this module with the real Auth.js v5 config and will instead
// `export { handlers, auth, signIn, signOut }` from that config.

export type Session = { user?: { id: string } };

/** Current session, or null when the visitor is anonymous. */
export async function auth(): Promise<Session | null> {
  return null;
}
