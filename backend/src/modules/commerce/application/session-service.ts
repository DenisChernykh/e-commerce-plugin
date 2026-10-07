import { CommerceError } from "../domain/model";

export interface SessionStore {
  saveSession(hash: string, owner: string, expiresAt: number): Promise<void>;
  session(hash: string, now: number): Promise<string | null>;
  saveLink(hash: string, owner: string, target: string, expiresAt: number): Promise<void>;
  exchange(
    hash: string,
    now: number,
    tokenHash: string,
    expiresAt: number,
  ): Promise<{ owner: string; target: string } | null>;
}
export const secretHash = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
export class SessionService {
  constructor(private readonly store: SessionStore) {}
  async guest() {
    const secret = token();
    await this.store.saveSession(
      await secretHash(secret),
      `guest:${crypto.randomUUID()}`,
      Date.now() + 30 * 86400_000,
    );
    return secret;
  }
  async owner(secret: string | undefined) {
    const owner =
      secret && /^[a-f0-9]{64}$/.test(secret)
        ? await this.store.session(await secretHash(secret), Date.now())
        : null;
    if (!owner)
      throw new CommerceError(
        "SESSION_REQUIRED",
        "Откройте магазин, чтобы продолжить со своей корзиной.",
        401,
      );
    return owner;
  }
  async link(owner: string, target: string) {
    const code = token();
    await this.store.saveLink(await secretHash(code), owner, target, Date.now() + 60_000);
    return { code, expiresIn: 60 };
  }
  async exchange(code: string) {
    const secret = token();
    const result = await this.store.exchange(
      await secretHash(code),
      Date.now(),
      await secretHash(secret),
      Date.now() + 30 * 86400_000,
    );
    if (!result)
      throw new CommerceError(
        "LINK_EXPIRED",
        "Ссылка уже использована или истекла. Откройте магазин из TIHO ещё раз.",
        401,
      );
    return { token: secret, target: result.target };
  }
}
