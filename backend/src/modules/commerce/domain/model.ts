export type Customer = { name: string; email: string };
export type Line = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  available: boolean;
  image: string | null;
  category: string;
  color: string;
  type: string;
};
export type Cart = {
  id: string;
  version: number;
  currency: "RUB";
  items: Line[];
  totalMinor: number;
  itemCount: number;
  changes: string[];
};
export type Quote = {
  id: string;
  cart: Cart;
  customer: Customer;
  expiresAt: string;
};
export type PaymentStatus = "awaiting_payment" | "processing" | "completed" | "failed";
export type Attempt = {
  id: string;
  orderId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  createdAt: string;
  completedAt: string | null;
};
export type Order = {
  id: string;
  number: string;
  createdAt: string;
  customer: Customer;
  items: Line[];
  totalMinor: number;
  currency: "RUB";
  status: "placed" | "confirmed";
  paymentStatus: PaymentStatus;
  attempt: Attempt | null;
};
export type CartAction =
  | { action: "add" | "set"; productId: string; quantity: number; operationId: string }
  | { action: "remove"; productId: string; operationId: string }
  | { action: "clear"; operationId: string };
export class CommerceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: 400 | 401 | 403 | 404 | 409 | 503 = 400,
  ) {
    super(message);
  }
}
export const totalCart = (cart: Cart): Cart => ({
  ...cart,
  items: cart.items.map((line) => ({
    ...line,
    lineTotalMinor: line.quantity * line.unitPriceMinor,
  })),
  totalMinor: cart.items.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0),
  itemCount: cart.items.reduce((sum, line) => sum + line.quantity, 0),
});
