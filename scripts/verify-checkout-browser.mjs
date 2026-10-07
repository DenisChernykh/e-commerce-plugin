import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const session = `tiho-purchase-${Date.now()}`;
const base = process.env.STORE_TEST_URL ?? 'http://localhost:3000';
const checks = [];
const failureFirst = process.env.PAYMENT_TEST_OUTCOME === 'fail_once';
function browser(...args) {
  const result = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8' }));
  assert.equal(result.success, true, JSON.stringify(result.error));
  return result.data;
}
const evaluate = (code) => browser('eval', code).result;
const body = () => evaluate('document.body.innerText');
const click = (text) => evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`);
async function until(fn, label) {
  const end = Date.now() + 25000;
  while (Date.now() < end) { if (fn()) return; await new Promise((r) => setTimeout(r, 150)); }
  throw new Error(`Timeout: ${label}\n${body()}`);
}
const cart = () => evaluate("fetch('/api/commerce/cart').then(r=>r.json())");
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS ${name}`); }
await mkdir('artifacts', { recursive: true });
try {
  browser('open', `${base}/cart`);
  await check('empty server cart and mobile navigation', async () => {
    await until(() => body().includes('Здесь пока тихо'), 'empty cart');
    browser('set', 'viewport', '390', '844');
    browser('find', 'role', 'button', 'click', '--name', 'Открыть меню');
    await until(() => body().includes('Плагины'), 'mobile plugins entry');
    assert.ok(evaluate("Array.from(document.querySelectorAll('a')).some(a=>a.href.endsWith('/plugins')&&a.getBoundingClientRect().width>0)"));
    browser('screenshot', `${process.cwd()}/artifacts/checkout-mobile-menu.png`);
    browser('press', 'Escape');
    browser('set', 'viewport', '1280', '900');
  });
  browser('open', `${base}/catalog?category=candles&availability=in_stock&priceTo=3000&sort=price_asc`);
  await until(() => body().includes('Свеча «Лаванда»'), 'catalog');
  const add = (index) => evaluate(`document.querySelectorAll('section[aria-label="Результаты поиска"] article')[${index}].querySelector('button').click()`);
  await check('search, separate additions, quantity, second product, deletion and server total', async () => {
    add(1);
    await until(() => cart().itemCount === 1, 'first addition');
    add(1);
    await until(() => cart().itemCount === 2, 'intentional second addition');
    add(2);
    await until(() => cart().items.length === 2, 'second product');
    browser('open', `${base}/cart`);
    await until(() => body().includes('Перейти к оформлению'), 'cart');
    evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')?.startsWith('Увеличить количество: Свеча «Лаванда»')).click()");
    await until(() => cart().itemCount === 4, 'quantity change');
    evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')?.startsWith('Удалить: Свеча «Чистый хлопок»')).click()");
    await until(() => cart().items.length === 1, 'remove');
    assert.equal(cart().totalMinor, 480000);
    browser('reload');
    await until(() => body().includes('4 800') || body().includes('4\u00a0800'), 'persisted cart');
    assert.equal(cart().itemCount, 3);
    browser('screenshot', `${process.cwd()}/artifacts/checkout-cart.png`);
  });
  await check('field validation, back navigation and contact persistence', async () => {
    click('Перейти к оформлению');
    await until(() => evaluate("!!document.querySelector('#recipient')"), 'contact form');
    click('Проверить заказ');
    await until(() => body().includes('Укажите имя получателя'), 'validation');
    browser('fill', '#recipient', 'Покупатель TIHO');
    browser('fill', '#email', 'purchase@example.test');
    click('Проверить заказ');
    await until(() => body().includes('Проверка заказа'), 'review');
    assert.ok(body().includes('purchase@example.test'));
    click('Изменить данные');
    assert.equal(evaluate("document.querySelector('#recipient').value"), 'Покупатель TIHO');
    browser('reload');
    await until(() => evaluate("document.querySelector('#email')?.value") === 'purchase@example.test', 'persisted contact');
    click('Проверить заказ');
    await until(() => body().includes('Оформить заказ'), 'new review');
    browser('screenshot', `${process.cwd()}/artifacts/checkout-review.png`);
  });
  let orderId;
  await check('double click creates one order and payment survives reload', async () => {
    evaluate("const b=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Оформить заказ');b.click();b.click()");
    await until(() => evaluate('location.pathname').endsWith('/payment'), 'payment route');
    await until(() => body().includes('Оплатить'), 'payment loaded');
    orderId = evaluate('location.pathname.split("/")[2]');
    const orders = evaluate("fetch('/api/commerce/orders').then(r=>r.json())");
    assert.equal(orders.items.length, 1);
    assert.equal(orders.items[0].id, orderId);
    assert.equal(cart().itemCount, 0);
    evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim().startsWith('Оплатить ')).click()");
    await until(() => body().includes('Обрабатываем платёж'), 'processing');
    browser('reload');
    if (failureFirst) {
      await until(() => body().includes('Не удалось завершить оплату'), 'saved payment failure');
      browser('screenshot', `${process.cwd()}/artifacts/checkout-payment-failure.png`);
      browser('reload');
      await until(() => body().includes('Попробовать ещё раз'), 'failure after reload');
      click('Попробовать ещё раз');
      await until(() => body().includes('Обрабатываем платёж'), 'retry processing');
      assert.equal(evaluate('location.pathname.split("/")[2]'), orderId);
      assert.equal(evaluate("fetch('/api/commerce/orders').then(r=>r.json()).then(o=>o.items.length)"), 1);
    }
    await until(() => body().includes('Заказ сохранён.'), 'confirmed result');
    browser('screenshot', `${process.cwd()}/artifacts/checkout-result.png`);
    click('Посмотреть заказ');
    await until(() => evaluate('location.pathname') === `/orders/${orderId}`, 'saved order route');
    browser('reload');
    await until(() => body().includes('purchase@example.test'), 'persisted order');
    assert.equal(evaluate(`fetch('/api/commerce/orders/${orderId}').then(r=>r.json()).then(o=>o.paymentStatus)`), 'completed');
    browser('set', 'viewport', '390', '844');
    assert.ok(evaluate('document.documentElement.scrollWidth <= innerWidth'));
    browser('screenshot', `${process.cwd()}/artifacts/checkout-order-mobile.png`);
  });
  await check('plugins and catalogue regression', async () => {
    browser('open', `${base}/plugins`);
    await until(() => body().includes('Скопировать адрес'), 'plugins');
    assert.ok(evaluate("document.querySelector('a[download]').getAttribute('href')").endsWith('.zip'));
    browser('open', `${base}/catalog?page=2`);
    await until(() => body().includes('Добавить в корзину'), 'catalog page 2');
    assert.ok(evaluate("document.querySelectorAll('article').length") > 0);
  });
  await writeFile(`artifacts/checkout-browser-${failureFirst ? 'failure-retry' : 'verification'}.json`, JSON.stringify({ checkedAt: new Date().toISOString(), environment: base, session, orderId, failureFirst, checks }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, orderId, session }));
} catch (error) {
  browser('screenshot', `${process.cwd()}/artifacts/checkout-browser-failure.png`);
  throw error;
}
