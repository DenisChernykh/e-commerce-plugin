import type { Attempt, Cart, Line, Order, Quote } from "../domain/model";

export interface CommerceRepository {
  cart(owner: string): Promise<Cart>;
  products(ids: string[]): Promise<Line[]>;
  saveCart(
    owner: string,
    before: Cart,
    after: Cart,
    operation?: { id: string; fingerprint: string },
  ): Promise<boolean>;
  operation(owner: string, id: string, fingerprint: string): Promise<Cart | null>;
  saveQuote(owner: string, quote: Quote): Promise<void>;
  quote(owner: string, id: string): Promise<Quote>;
  order(owner: string, id: string): Promise<Order>;
  orders(owner: string): Promise<Order[]>;
  orderForIntent(owner: string, quoteId: string, operationId: string): Promise<Order | null>;
  commitOrder(owner: string, quote: Quote, operationId: string): Promise<Order>;
  startAttempt(
    owner: string,
    order: Order,
    operationId: string,
    outcome: "success" | "failure" | "fail_once",
    delayMs: number,
  ): Promise<Attempt>;
  attempt(owner: string, id: string): Promise<Attempt>;
}
