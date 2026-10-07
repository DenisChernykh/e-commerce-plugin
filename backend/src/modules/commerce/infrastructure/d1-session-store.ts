import type { SessionStore } from "../application/session-service";

export class D1SessionStore implements SessionStore {
  constructor(private readonly db: D1Database) {}
  async saveSession(hash: string, owner: string, expiresAt: number) {
    await this.db
      .prepare("INSERT INTO commerce_sessions(token_hash,owner,expires_at) VALUES(?,?,?)")
      .bind(hash, owner, expiresAt)
      .run();
  }
  async session(hash: string, now: number) {
    const row = await this.db
      .prepare("SELECT owner FROM commerce_sessions WHERE token_hash=? AND expires_at>?")
      .bind(hash, now)
      .first<{ owner: string }>();
    return row?.owner ?? null;
  }
  async saveLink(hash: string, owner: string, target: string, expiresAt: number) {
    await this.db
      .prepare("INSERT INTO commerce_links(code_hash,owner,target,expires_at) VALUES(?,?,?,?)")
      .bind(hash, owner, target, expiresAt)
      .run();
  }
  async exchange(hash: string, now: number, tokenHash: string, expiresAt: number) {
    const results = await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO commerce_sessions(token_hash,owner,expires_at) SELECT ?,owner,? FROM commerce_links WHERE code_hash=? AND expires_at>?",
        )
        .bind(tokenHash, expiresAt, hash, now),
      this.db
        .prepare(
          "DELETE FROM commerce_links WHERE code_hash=? AND expires_at>? RETURNING owner,target",
        )
        .bind(hash, now),
    ]);
    return (results[1]?.results[0] as { owner: string; target: string } | undefined) ?? null;
  }
}
