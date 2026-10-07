import {
  type Cart,
  type CartAction,
  CommerceError,
  type Customer,
  totalCart,
} from "../domain/model";
import type { CommerceRepository } from "./ports";

export type PaymentConfig = {
  enabled: boolean;
  outcome: "success" | "failure" | "fail_once";
  delayMs: number;
};

export class CommerceService {
  constructor(
    private readonly repository: CommerceRepository,
    private readonly payment: PaymentConfig,
  ) {}

  async cart(owner: string): Promise<Cart> {
    for (let retry = 0; retry < 8; retry++) {
      const cart = await this.repository.cart(owner);
      const products = await this.repository.products(cart.items.map((line) => line.productId));
      const changes: string[] = [];
      const items = cart.items.map((line) => {
        const product = products.find((p) => p.productId === line.productId);
        if (!product) {
          if (line.available) changes.push(`«${line.name}» больше недоступен.`);
          return { ...line, available: false };
        }
        if (line.unitPriceMinor !== product.unitPriceMinor)
          changes.push(`Цена «${line.name}» изменилась. Проверьте итог.`);
        if (line.available !== product.available)
          changes.push(`Наличие «${line.name}» изменилось.`);
        return { ...product, quantity: line.quantity };
      });
      const fresh = totalCart({ ...cart, items, changes });
      if (JSON.stringify(fresh.items) === JSON.stringify(cart.items)) return fresh;
      fresh.version++;
      if (await this.repository.saveCart(owner, cart, fresh)) return fresh;
    }
    throw new CommerceError(
      "CART_BUSY",
      "Корзина обновляется в другом окне. Повторите запрос.",
      409,
    );
  }

  async change(owner: string, input: CartAction) {
    const fingerprint = JSON.stringify(input);
    for (let retry = 0; retry < 8; retry++) {
      const previous = await this.repository.operation(owner, input.operationId, fingerprint);
      if (previous) return previous;
      const before = await this.cart(owner);
      let items = before.items.map((line) => ({ ...line }));
      if (input.action === "clear") items = [];
      else if (input.action === "remove")
        items = items.filter((line) => line.productId !== input.productId);
      else {
        if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 99)
          throw new CommerceError("INVALID_QUANTITY", "Выберите целое количество от 1 до 99.");
        const [product] = await this.repository.products([input.productId]);
        if (!product) throw new CommerceError("PRODUCT_NOT_FOUND", "Товар не найден.", 404);
        if (!product.available)
          throw new CommerceError("UNAVAILABLE", "Этот товар сейчас недоступен.", 409);
        const line = items.find((item) => item.productId === input.productId);
        const quantity =
          input.action === "add" ? (line?.quantity ?? 0) + input.quantity : input.quantity;
        if (quantity > 99)
          throw new CommerceError(
            "INVALID_QUANTITY",
            "Можно добавить не более 99 штук одного товара.",
          );
        if (line) Object.assign(line, product, { quantity });
        else items.push({ ...product, quantity });
      }
      if (items.length > 50)
        throw new CommerceError("CART_LIMIT", "В корзине может быть не более 50 разных товаров.");
      const after = totalCart({ ...before, version: before.version + 1, items });
      if (
        await this.repository.saveCart(owner, before, after, { id: input.operationId, fingerprint })
      )
        return after;
    }
    throw new CommerceError("CART_BUSY", "Корзина обновляется. Проверьте её перед повтором.", 409);
  }

  async prepare(owner: string, cartVersion: number, customer: Customer) {
    const cart = await this.cart(owner);
    if (cart.version !== cartVersion)
      throw new CommerceError(
        "CART_CHANGED",
        "Состав, цены или наличие изменились. Проверьте корзину и подтвердите новые условия.",
        409,
      );
    if (!cart.items.length) throw new CommerceError("EMPTY_CART", "Добавьте товары в корзину.");
    if (cart.items.some((line) => !line.available))
      throw new CommerceError("UNAVAILABLE", "Уберите недоступные товары перед оформлением.", 409);
    const quote = {
      id: crypto.randomUUID(),
      cart,
      customer,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
    await this.repository.saveQuote(owner, quote);
    return quote;
  }

  async createOrder(owner: string, quoteId: string, operationId: string) {
    const existing = await this.repository.orderForIntent(owner, quoteId, operationId);
    if (existing) return existing;
    if (!this.payment.enabled)
      throw new CommerceError(
        "CHECKOUT_UNAVAILABLE",
        "Оформление сейчас недоступно. Корзина сохранена.",
        503,
      );
    const quote = await this.repository.quote(owner, quoteId);
    if (quote.expiresAt <= new Date().toISOString())
      throw new CommerceError(
        "QUOTE_EXPIRED",
        "Время подтверждения истекло. Проверьте актуальный итог.",
        409,
      );
    const cart = await this.cart(owner);
    if (cart.version !== quote.cart.version)
      throw new CommerceError(
        "CART_CHANGED",
        "Корзина изменилась. Проверьте новый состав и итог перед оформлением.",
        409,
      );
    return this.repository.commitOrder(owner, quote, operationId);
  }

  order(owner: string, id: string) {
    return this.repository.order(owner, id);
  }
  quote(owner: string, id: string) {
    return this.repository.quote(owner, id);
  }
  orders(owner: string) {
    return this.repository.orders(owner);
  }
  async pay(owner: string, orderId: string, operationId: string) {
    if (!this.payment.enabled)
      throw new CommerceError(
        "PAYMENT_UNAVAILABLE",
        "Оплата сейчас недоступна. Заказ сохранён.",
        503,
      );
    const order = await this.repository.order(owner, orderId);
    return this.repository.startAttempt(
      owner,
      order,
      operationId,
      this.payment.outcome,
      this.payment.delayMs,
    );
  }
  attempt(owner: string, id: string) {
    return this.repository.attempt(owner, id);
  }
}
