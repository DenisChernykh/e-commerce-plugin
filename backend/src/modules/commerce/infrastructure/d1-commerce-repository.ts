import type { CommerceRepository } from "../application/ports";
import {
  type Attempt,
  type Cart,
  CommerceError,
  type Line,
  type Order,
  type Quote,
} from "../domain/model";

type StoredAttempt = {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};
const mapAttempt = (a: StoredAttempt): Attempt => ({
  id: a.id,
  orderId: a.order_id,
  status: a.status === "internal_succeeded" ? "succeeded" : (a.status as Attempt["status"]),
  createdAt: a.created_at,
  completedAt: a.completed_at,
});
const notFound = () => new CommerceError("NOT_FOUND", "Данные не найдены в вашей сессии.", 404);
const conflict = () =>
  new CommerceError(
    "CART_CHANGED",
    "Состав, цены или наличие изменились. Проверьте корзину и подтвердите новые условия.",
    409,
  );

export class D1CommerceRepository implements CommerceRepository {
  constructor(private readonly db: D1Database) {}
  private sql(query: string, ...args: (string | number | null)[]) {
    return this.db.prepare(query).bind(...args);
  }

  async cart(owner: string): Promise<Cart> {
    const empty: Cart = {
      id: crypto.randomUUID(),
      version: 0,
      currency: "RUB",
      items: [],
      totalMinor: 0,
      itemCount: 0,
      changes: [],
    };
    await this.sql(
      "INSERT OR IGNORE INTO commerce_carts(owner,id,version,snapshot) VALUES(?,?,0,?)",
      owner,
      empty.id,
      JSON.stringify(empty),
    ).run();
    const row = await this.sql("SELECT snapshot FROM commerce_carts WHERE owner=?", owner).first<{
      snapshot: string;
    }>();
    return JSON.parse(row!.snapshot) as Cart;
  }

  async products(ids: string[]): Promise<Line[]> {
    if (!ids.length) return [];
    const rows = await this.sql(
      `SELECT p.id AS productId,p.slug,p.name,p.price_kopecks AS unitPriceMinor,
      p.availability,p.color_hex AS color,p.type_slug AS type,c.slug AS category,
      (SELECT url FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS image
      FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id IN (${ids.map(() => "?").join(",")})`,
      ...ids,
    ).all<Omit<Line, "available" | "quantity" | "lineTotalMinor"> & { availability: string }>();
    return rows.results.map(({ availability, ...row }) => ({
      ...row,
      available: availability === "in_stock",
      quantity: 1,
      lineTotalMinor: row.unitPriceMinor,
    }));
  }

  async operation(owner: string, id: string, fingerprint: string): Promise<Cart | null> {
    const row = await this.sql(
      "SELECT fingerprint,snapshot FROM commerce_operations WHERE owner=? AND id=?",
      owner,
      id,
    ).first<{ fingerprint: string; snapshot: string }>();
    if (row && row.fingerprint !== fingerprint)
      throw new CommerceError(
        "INTENT_CONFLICT",
        "Это действие уже выполнено с другими параметрами. Для нового действия нужен новый идентификатор.",
        409,
      );
    return row ? (JSON.parse(row.snapshot) as Cart) : null;
  }

  async saveCart(
    owner: string,
    before: Cart,
    after: Cart,
    operation?: { id: string; fingerprint: string },
  ) {
    try {
      await this.db.batch([
        this.sql(
          "UPDATE commerce_carts SET version=?,snapshot=? WHERE owner=? AND version=?",
          after.version,
          JSON.stringify({ ...after, changes: [] }),
          owner,
          before.version,
        ),
        this.sql(
          "INSERT INTO commerce_operations(owner,id,fingerprint,snapshot,applied) VALUES(?,?,?,?,changes())",
          owner,
          operation?.id ?? crypto.randomUUID(),
          operation?.fingerprint ?? "reprice",
          JSON.stringify(after),
        ),
      ]);
      return true;
    } catch (error) {
      if (/commerce_cas_applied|UNIQUE constraint failed: commerce_operations/.test(String(error)))
        return false;
      throw error;
    }
  }

  async saveQuote(owner: string, quote: Quote) {
    await this.sql(
      "INSERT INTO commerce_quotes(id,owner,cart_version,snapshot,expires_at) VALUES(?,?,?,?,?)",
      quote.id,
      owner,
      quote.cart.version,
      JSON.stringify(quote),
      quote.expiresAt,
    ).run();
  }
  async quote(owner: string, id: string): Promise<Quote> {
    const row = await this.sql(
      "SELECT snapshot FROM commerce_quotes WHERE owner=? AND id=?",
      owner,
      id,
    ).first<{ snapshot: string }>();
    if (!row) throw notFound();
    return JSON.parse(row.snapshot) as Quote;
  }

  async orderForIntent(owner: string, quoteId: string, operationId: string): Promise<Order | null> {
    const row = await this.sql(
      `SELECT o.id,o.quote_id,o.operation_id,q.cart_version FROM commerce_orders o
      JOIN commerce_quotes q ON q.id=? AND q.owner=? WHERE o.owner=? AND (o.operation_id=? OR o.cart_version=q.cart_version) LIMIT 1`,
      quoteId,
      owner,
      owner,
      operationId,
    ).first<{ id: string; quote_id: string; operation_id: string }>();
    if (!row) {
      const reused = await this.sql(
        "SELECT id FROM commerce_orders WHERE owner=? AND operation_id=?",
        owner,
        operationId,
      ).first();
      if (reused)
        throw new CommerceError("INTENT_CONFLICT", "Действие относится к другому заказу.", 409);
      return null;
    }
    if (row.operation_id === operationId && row.quote_id !== quoteId)
      throw new CommerceError("INTENT_CONFLICT", "Действие относится к другой сводке заказа.", 409);
    return this.order(owner, row.id);
  }

  async commitOrder(owner: string, quote: Quote, operationId: string): Promise<Order> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const number = `TH-${createdAt.slice(2, 10).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`;
    const order: Order = {
      id,
      number,
      createdAt,
      customer: quote.customer,
      items: quote.cart.items,
      totalMinor: quote.cart.totalMinor,
      currency: quote.cart.currency,
      status: "placed",
      paymentStatus: "awaiting_payment",
      attempt: null,
    };
    // Batch is a D1 transaction. CHECK failure rolls back the order AND cart change.
    // Catalogue prices/availability are rechecked inside the same transaction.
    const remainder = {
      ...quote.cart,
      version: quote.cart.version + 1,
      items: [],
      totalMinor: 0,
      itemCount: 0,
      changes: [],
    };
    try {
      await this.db.batch([
        this.sql(
          `INSERT INTO commerce_orders(id,number,owner,cart_version,quote_id,operation_id,snapshot,created_at,payment_mode,payment_status,valid)
          SELECT ?,?,?,?,?,?,?,?,'internal_presentation','awaiting_payment',
          CASE WHEN c.version=? AND q.expires_at>? AND NOT EXISTS(
            SELECT 1 FROM json_each(q.snapshot,'$.cart.items') j LEFT JOIN products p ON p.id=json_extract(j.value,'$.productId')
            WHERE p.id IS NULL OR p.availability!='in_stock' OR p.price_kopecks!=json_extract(j.value,'$.unitPriceMinor')
          ) THEN 1 ELSE 0 END FROM commerce_carts c JOIN commerce_quotes q ON q.id=? AND q.owner=c.owner WHERE c.owner=?`,
          id,
          number,
          owner,
          quote.cart.version,
          quote.id,
          operationId,
          JSON.stringify(order),
          createdAt,
          quote.cart.version,
          createdAt,
          quote.id,
          owner,
        ),
        this.sql(
          `UPDATE commerce_carts SET version=?,snapshot=? WHERE owner=? AND version=? AND EXISTS(SELECT 1 FROM commerce_orders WHERE id=?)`,
          remainder.version,
          JSON.stringify(remainder),
          owner,
          quote.cart.version,
          id,
        ),
      ]);
    } catch (error) {
      const existing = await this.orderForIntent(owner, quote.id, operationId);
      if (existing) return existing;
      if (/commerce_order_valid|UNIQUE constraint failed/.test(String(error))) throw conflict();
      throw error;
    }
    return this.order(owner, id);
  }

  private async settle(orderId: string) {
    // Durable clock-based adapter: polling or reopening resumes after a Worker restart.
    // No external provider, financial settlement, reservation or email is involved.
    const now = Date.now();
    await this.db.batch([
      this.sql(
        "UPDATE commerce_attempts SET status='processing' WHERE order_id=? AND status='pending'",
        orderId,
      ),
      this.sql(
        "UPDATE commerce_attempts SET status=outcome,completed_at=? WHERE order_id=? AND status='processing' AND ready_at<=?",
        new Date(now).toISOString(),
        orderId,
        now,
      ),
      this.sql(
        `UPDATE commerce_orders SET payment_status=COALESCE((SELECT CASE status WHEN 'internal_succeeded' THEN 'completed' WHEN 'failed' THEN 'failed' ELSE 'processing' END
        FROM commerce_attempts WHERE order_id=? ORDER BY rowid DESC LIMIT 1),'awaiting_payment') WHERE id=?`,
        orderId,
        orderId,
      ),
    ]);
  }

  async order(owner: string, id: string): Promise<Order> {
    const row = await this.sql(
      "SELECT snapshot FROM commerce_orders WHERE owner=? AND id=?",
      owner,
      id,
    ).first<{ snapshot: string }>();
    if (!row) throw notFound();
    await this.settle(id);
    const payment = await this.sql(
      "SELECT payment_status FROM commerce_orders WHERE owner=? AND id=?",
      owner,
      id,
    ).first<{ payment_status: Order["paymentStatus"] }>();
    const attempt = await this.sql(
      "SELECT * FROM commerce_attempts WHERE order_id=? ORDER BY rowid DESC LIMIT 1",
      id,
    ).first<StoredAttempt>();
    return {
      ...(JSON.parse(row.snapshot) as Order),
      status: payment!.payment_status === "completed" ? "confirmed" : "placed",
      paymentStatus: payment!.payment_status,
      attempt: attempt ? mapAttempt(attempt) : null,
    };
  }
  async orders(owner: string) {
    const rows = await this.sql(
      "SELECT id FROM commerce_orders WHERE owner=? ORDER BY created_at DESC LIMIT 50",
      owner,
    ).all<{ id: string }>();
    return Promise.all(rows.results.map((row) => this.order(owner, row.id)));
  }

  async startAttempt(
    owner: string,
    order: Order,
    operationId: string,
    outcome: "success" | "failure" | "fail_once",
    delayMs: number,
  ): Promise<Attempt> {
    const previous = await this.sql(
      "SELECT * FROM commerce_attempts WHERE owner=? AND operation_id=?",
      owner,
      operationId,
    ).first<StoredAttempt>();
    if (previous) {
      if (previous.order_id !== order.id)
        throw new CommerceError("INTENT_CONFLICT", "Это действие относится к другому заказу.", 409);
      return this.attempt(owner, previous.id);
    }
    if (order.attempt && order.attempt.status !== "failed") return order.attempt;
    const id = crypto.randomUUID();
    try {
      await this.db.batch([
        this.sql(
          `INSERT INTO commerce_attempts(id,owner,order_id,operation_id,status,outcome,created_at,ready_at)
          VALUES(?,?,?,?,'pending',CASE WHEN ?='failure' OR (?='fail_once' AND NOT EXISTS(SELECT 1 FROM commerce_attempts WHERE order_id=?)) THEN 'failed' ELSE 'internal_succeeded' END,?,?)`,
          id,
          owner,
          order.id,
          operationId,
          outcome,
          outcome,
          order.id,
          new Date().toISOString(),
          Date.now() + delayMs,
        ),
        this.sql(
          "UPDATE commerce_orders SET payment_status='processing' WHERE id=? AND owner=?",
          order.id,
          owner,
        ),
      ]);
    } catch (error) {
      if (!/UNIQUE constraint failed/.test(String(error))) throw error;
      const current = await this.order(owner, order.id);
      if (current.attempt) return current.attempt;
      throw error;
    }
    const row = await this.sql(
      "SELECT * FROM commerce_attempts WHERE id=?",
      id,
    ).first<StoredAttempt>();
    return mapAttempt(row!);
  }
  async attempt(owner: string, id: string) {
    const row = await this.sql(
      "SELECT * FROM commerce_attempts WHERE owner=? AND id=?",
      owner,
      id,
    ).first<StoredAttempt>();
    if (!row) throw notFound();
    await this.settle(row.order_id);
    return mapAttempt(
      (await this.sql("SELECT * FROM commerce_attempts WHERE id=?", id).first<StoredAttempt>())!,
    );
  }
}
