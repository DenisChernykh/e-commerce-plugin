import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Fault injection drops a response AFTER the real backend has committed.
// No cart, order or payment result is mocked.
const session = `tiho-recovery-${Date.now()}`;
function browser(...args) {
  const value = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8' }));
  assert.equal(value.success, true, JSON.stringify(value.error));
  return value.data;
}
const evaluate = code => browser('eval', code).result;
const body = () => evaluate('document.body.innerText');
const click = text => evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
async function until(predicate) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timeout: ${body()}`);
}
function dropResponse(path) {
  evaluate(`window.tihoOriginalFetch=window.fetch.bind(window);window.tihoDrop=true;window.fetch=async(...args)=>{const response=await window.tihoOriginalFetch(...args);if(window.tihoDrop&&args[0]===${JSON.stringify(path)}&&args[1]?.method==='POST'){window.tihoDrop=false;await response.text();throw new TypeError('Injected lost response after commit')}return response};true`);
}
browser('open', 'http://localhost:3000/cart');
await until(() => body().includes('Здесь пока тихо'));
evaluate(`fetch('/api/products?category=candles&availability=in_stock&pageSize=1').then(r=>r.json()).then(p=>fetch('/api/commerce/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',productId:p.items[0].id,quantity:1,operationId:crypto.randomUUID()})})).then(r=>r.ok)`);
browser('reload');
await until(() => body().includes('Перейти к оформлению'));
click('Перейти к оформлению');
await until(() => evaluate("!!document.querySelector('#recipient')"));
browser('fill', '#recipient', 'Покупатель TIHO');
browser('fill', '#email', 'recovery@example.test');
click('Проверить заказ');
await until(() => body().includes('Оформить заказ'));
dropResponse('/api/commerce/orders');
click('Оформить заказ');
await until(() => body().includes('Ответ магазина не получен'));
const saved = evaluate("fetch('/api/commerce/orders').then(r=>r.json())");
assert.equal(saved.items.length, 1);
assert.equal(evaluate('location.pathname'), '/checkout');
browser('reload');
await until(() => evaluate('location.pathname') === `/orders/${saved.items[0].id}/payment`);
await until(() => body().includes('Оплатить'));
assert.equal(evaluate("fetch('/api/commerce/orders').then(r=>r.json()).then(o=>o.items.length)"), 1);
dropResponse(`/api/commerce/orders/${saved.items[0].id}/payment`);
evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith('Оплатить ')).click()");
await until(() => body().includes('Обрабатываем платёж') || body().includes('Ответ магазина не получен'));
browser('reload');
await until(() => body().includes('Заказ сохранён.'));
const result = evaluate(`fetch('/api/commerce/orders/${saved.items[0].id}').then(r=>r.json())`);
assert.equal(result.paymentStatus, 'completed');
assert.equal(result.customer.email, 'recovery@example.test');
await writeFile('artifacts/checkout-recovery-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), session, orderId: result.id, attemptId: result.attempt.id, checks: ['lost create response recovers same order after reload', 'lost payment response recovers persisted attempt after reload', 'contacts preserved; only one order'] }, null, 2) + '\n');
console.log('PASS lost create/payment responses: same persisted order and attempt after reload');
browser('close');
