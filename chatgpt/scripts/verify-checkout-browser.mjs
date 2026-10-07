import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

// Real D1 + the shipped MCP Apps bundle, inside the explicitly labelled local
// host. This does not claim to be verification inside ChatGPT.
const session = `tiho-mcp-purchase-${Date.now()}`;
function browser(...args) {
  const response = JSON.parse(
    execFileSync("agent-browser", ["--session", session, "--json", ...args], { encoding: "utf8" }),
  );
  assert.equal(response.success, true, JSON.stringify(response.error));
  return response.data;
}
const evaluate = (code) => browser("eval", code).result;
const dom = (code) =>
  evaluate(`(()=>{const d=document.querySelector('iframe').contentDocument;${code}})()`);
const body = () => dom("return d.body.innerText");
const context = () => evaluate("window.tihoContext");
const button = (name) =>
  dom(
    `Array.from(d.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(name)}).click()`,
  );
const call = (name, args = {}) =>
  evaluate(`window.tihoTool(${JSON.stringify(name)},${JSON.stringify(args)})`);
const cart = () => call("get_cart").structuredContent.data;
async function until(predicate, label) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timeout: ${label}\n${body()}`);
}
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log(`PASS ${name}`);
}
await mkdir("artifacts", { recursive: true });
browser("open", "http://127.0.0.1:8790/preview");
await until(
  () => context()?.selection && context()?.shopping?.cart,
  "catalog and authenticated shopping context",
);
// The local MCP identity is dedicated to verification. No actual user's cart.
call("update_cart", { action: "clear", operationId: crypto.randomUUID() });
await check("hidden panels pause server polling and model context updates", async () => {
  evaluate(
    `window.tihoVisibilityProbe={reads:0,updates:0};window.addEventListener('message',event=>{if(event.source!==document.querySelector('iframe').contentWindow)return;const m=event.data;if(m.method==='tools/call'&&m.params?.name==='get_cart')window.tihoVisibilityProbe.reads++;if(m.method==='ui/update-model-context')window.tihoVisibilityProbe.updates++});document.querySelector('iframe').style.display='none'`,
  );
  await new Promise((resolve) => setTimeout(resolve, 700));
  const hidden = evaluate("window.tihoVisibilityProbe");
  await new Promise((resolve) => setTimeout(resolve, 6200));
  assert.deepEqual(evaluate("window.tihoVisibilityProbe"), hidden);
  evaluate("document.querySelector('iframe').style.display='block'");
  await until(
    () => evaluate("window.tihoVisibilityProbe.reads") > hidden.reads,
    "visible panel resumes polling",
  );
});
await check("manual add and chat tool update agree, preserve selection and total", async () => {
  const args = {
    search: {
      changes: { category: "candles", availability: "in_stock", priceTo: 3000, sort: "price_asc" },
    },
  };
  evaluate(`window.tihoShow(${JSON.stringify(args)})`);
  await until(() => context().selection.params.category === "candles", "filtered selection");
  const selection = context().selection;
  dom("d.querySelectorAll('article')[1].querySelectorAll('button')[1].click()");
  await until(() => context().shopping.cart.itemCount === 1, "manual add published");
  const input = {
    action: "add",
    product: { selection, position: 2 },
    quantity: 2,
    operationId: crypto.randomUUID(),
  };
  assert.ok(!call("update_cart", input).isError);
  assert.ok(!call("update_cart", input).isError);
  await until(
    () => context().shopping.cart.itemCount === 3,
    "tool change visible in existing panel",
  );
  assert.deepEqual(context().selection, selection);
  assert.equal(cart().totalMinor, 480000);
  dom(
    "Array.from(d.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')?.startsWith('Корзина')).click()",
  );
  await until(() => body().includes("Перейти к оформлению"), "cart screen");
  dom("d.querySelector('button[aria-label^=\"Увеличить количество\"]').click()");
  await until(() => cart().itemCount === 4, "quantity");
  dom("d.querySelector('button[aria-label^=\"Уменьшить количество\"]').click()");
  await until(() => cart().itemCount === 3, "quantity decrease");
  assert.equal(cart().totalMinor, 480000);
});
await check("checkout form and quote are reflected in model context", async () => {
  button("Перейти к оформлению");
  await until(() => dom("return !!d.querySelector('#recipient')"), "form");
  dom(
    "const set=Object.getOwnPropertyDescriptor(d.defaultView.HTMLInputElement.prototype,'value').set;for(const [id,value] of [['recipient','Покупатель в чате'],['email','chat-browser@example.test']]){const input=d.getElementById(id);set.call(input,value);input.dispatchEvent(new d.defaultView.Event('input',{bubbles:true}))}",
  );
  button("Проверить заказ");
  await until(
    () => context().shopping.quote?.customer.email === "chat-browser@example.test",
    "quote context",
  );
  assert.ok(body().includes("4 800") || body().includes("4\u00a0800"));
  button("Изменить данные");
  assert.equal(dom("return d.querySelector('#email').value"), "chat-browser@example.test");
  button("Проверить заказ");
  await until(() => body().includes("Оформить заказ"), "review");
  button("Оформить заказ");
  await until(() => body().includes("Оплатить"), "payment");
});
let orderId;
await check("saved payment and order recover after host reload", async () => {
  orderId = context().shopping.orderId;
  assert.ok(orderId);
  evaluate(`window.tihoShowCheckout(${JSON.stringify({ view: "payment", orderId })})`);
  await until(() => body().includes("Оплатить"), "host payment tool");
  dom(
    "Array.from(d.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith('Оплатить ')).click()",
  );
  await until(() => body().includes("Обрабатываем платёж"), "processing");
  browser("reload");
  await until(() => body().includes("Заказ сохранён."), "restored payment");
  assert.equal(call("get_order", { orderId }).structuredContent.data.paymentStatus, "completed");
  button("Посмотреть заказ");
  await until(() => body().includes("chat-browser@example.test"), "persisted order");
  browser("screenshot", `${process.cwd()}/artifacts/mcp-checkout-order.png`);
});
await check("one-time website transition uses the same owner and order", async () => {
  const link = call("store_link", { target: `/orders/${orderId}` });
  assert.ok(link._meta.storeLink);
  assert.ok(!JSON.stringify(link.content).includes(link._meta.storeLink));
  // Opening the actual UI link exercises its HTTP exchange and HttpOnly cookie.
  browser("tab", "new", link._meta.storeLink);
  await until(
    () => evaluate("document.body.innerText.includes('chat-browser@example.test')"),
    "linked website order",
  );
  assert.equal(evaluate("location.hash"), "");
  assert.equal(evaluate(`fetch('/api/commerce/orders/${orderId}').then(r=>r.status)`), 200);
  assert.equal(evaluate("document.cookie.includes('tiho_session')"), false);
  browser("screenshot", `${process.cwd()}/artifacts/mcp-linked-order.png`);
});
await writeFile(
  "artifacts/mcp-checkout-browser-verification.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      environment: "Local MCP Apps host → local Hono/D1; not ChatGPT",
      orderId,
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ passed: checks.length, orderId }));
