import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Browser smoke test: actual DOM interactions and MCP calls to the real catalog.
// This test host exercises the same bundled resource; it is not ChatGPT itself.
const session = "tiho-browser-verification";
function browser(...args) {
  const result = JSON.parse(
    execFileSync("agent-browser", ["--session", session, "--json", ...args], { encoding: "utf8" }),
  );
  assert.equal(result.success, true, JSON.stringify(result.error));
  return result.data;
}
const evaluate = (code) => browser("eval", code).result;
const context = () => evaluate("window.tihoContext");
const dom = (code) =>
  evaluate(`(()=>{const d=document.querySelector('iframe').contentDocument;${code}})()`);
const button = (name) =>
  dom(
    `Array.from(d.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(name)}).click()`,
  );
async function until(predicate) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Browser condition timed out");
}
async function changed(action, predicate) {
  action();
  await until(() => predicate(context()));
}
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log(`PASS ${name}`);
}
browser("open", "http://127.0.0.1:8790/preview");
await until(() => context()?.selection);
await check("cards and tool context agree", async () => {
  assert.equal(
    dom("return d.querySelectorAll('button[aria-label^=\"Открыть вариант\"]').length"),
    context().selection.productIds.length,
  );
  assert.equal(
    dom(
      "return d.querySelectorAll('svg[role=img]').length>0 || d.querySelectorAll('svg').length>0",
    ),
    true,
  );
});
await check("multiple filters and removing only color", async () => {
  button("Фильтры");
  await until(() => dom("return !!d.querySelector('[id$=\"-category-candles\"]')"));
  await changed(
    () => dom("d.querySelector('[id$=\"-category-candles\"]').click()"),
    (c) => c.selection.params.category === "candles",
  );
  await changed(
    () => dom("d.querySelector('[id$=\"-stock\"]').click()"),
    (c) => c.selection.params.availability === "in_stock",
  );
  await changed(
    () => dom("d.querySelector('[id$=\"-color-beige\"]').click()"),
    (c) => c.selection.params.color === "beige",
  );
  assert.equal(context().selection.params.category, "candles");
  await changed(
    () => dom("d.querySelector('button[aria-label=\"Убрать фильтр: Бежевый\"]').click()"),
    (c) => !c.selection.params.color,
  );
  assert.equal(context().selection.params.availability, "in_stock");
  assert.equal(context().selection.params.category, "candles");
});
await check("sort, second item, back and concrete comparison", async () => {
  await changed(
    () =>
      dom(
        "const s=d.querySelector('select');s.value='price_asc';s.dispatchEvent(new s.ownerDocument.defaultView.Event('change',{bubbles:true}))",
      ),
    (c) => c.selection.params.sort === "price_asc",
  );
  const shown = context().selection;
  await changed(
    () => dom("d.querySelector('button[aria-label^=\"Открыть вариант 2:\"]').click()"),
    (c) => c.view === "product",
  );
  assert.equal(context().productId, shown.productIds[1]);
  await changed(
    () => button("К подборке"),
    (c) => c.view === "catalog",
  );
  assert.deepEqual(context().selection, shown);
  dom(
    "const c=d.querySelectorAll('input[type=checkbox]');Array.from(c).filter(e=>e.closest('article'))[0].click()",
  );
  dom(
    "const c=d.querySelectorAll('input[type=checkbox]');Array.from(c).filter(e=>e.closest('article'))[2].click()",
  );
  await changed(
    () => button("Сравнить выбранные (2)"),
    (c) => c.view === "compare",
  );
  assert.deepEqual(context().comparedIds, [shown.productIds[0], shown.productIds[2]]);
  assert.ok(dom("return d.querySelector('table').innerText").includes("Цена"));
  await changed(
    () => button("К подборке"),
    (c) => c.view === "catalog",
  );
  assert.deepEqual(context().selection, shown);
});
await check("next page and previous selection", async () => {
  await changed(
    () => button("Сбросить всё"),
    (c) => !c.selection.params.category,
  );
  const before = context().selection;
  await changed(
    () => button("Показать ещё"),
    (c) => c.selection.params.page === 2,
  );
  assert.equal(context().selection.params.sort, before.params.sort);
  assert.ok(context().selection.productIds.every((id) => !before.productIds.includes(id)));
  await changed(
    () => button("К подборке"),
    (c) => c.selection.params.page === 1,
  );
  assert.deepEqual(context().selection, before);
});
await check("empty state does not invent products", async () => {
  dom(
    "const input=d.querySelector('input[name=q]');input.value='несуществующийпредмет';input.form.requestSubmit()",
  );
  await until(() => context().selection.params.q === "несуществующийпредмет");
  assert.deepEqual(context().selection.productIds, []);
  assert.ok(dom("return d.body.innerText").includes("Ничего не найдено"));
  await changed(
    () => button("К подборке"),
    (c) => !c.selection.params.q,
  );
});
await check("independent UI instances", async () => {
  const original = context();
  evaluate(
    "const f=document.createElement('iframe');f.id='second-ui';f.src='/preview';document.body.append(f)",
  );
  await until(() =>
    evaluate("document.querySelector('#second-ui').contentWindow.tihoContext?.selection!=null"),
  );
  const second = evaluate("document.querySelector('#second-ui').contentWindow.tihoContext");
  assert.notEqual(second.uiInstanceId, original.uiInstanceId);
  assert.notEqual(second.selection.id, original.selection.id);
  assert.deepEqual(context(), original);
  evaluate("document.querySelector('#second-ui').remove()");
});
await check("server visual result preserves selection history", async () => {
  const prior = context().selection;
  const args = {
    search: {
      base: prior.params,
      changes: {
        category: "candles",
        availability: "in_stock",
        priceTo: 3000,
        sort: "price_asc",
        pageSize: 3,
      },
    },
    previousSelections: [prior],
  };
  const result = evaluate(`window.tihoShow(${JSON.stringify(args)})`);
  assert.ok(!result.isError);
  await until(() => context().selection.id === result.structuredContent.data.selection.id);
  assert.deepEqual(context().previousSelections, [prior]);
  assert.deepEqual(context().selection.params, result.structuredContent.data.selection.params);
  await changed(
    () => button("К подборке"),
    (c) => !c.selection.params.category,
  );
  assert.deepEqual(context().selection.productIds, prior.productIds);
  assert.deepEqual(context().previousSelections, []);
});
await check(
  "browser transport failure keeps last results and retry recovers (fault injection)",
  async () => {
    const before = context().selection;
    browser("network", "route", "**/mcp", "--abort");
    try {
      button("Показать ещё");
      await until(() =>
        dom(
          "return Array.from(d.querySelectorAll('[role=alert]')).some(e=>e.textContent.includes('Повторить'))",
        ),
      );
      assert.deepEqual(context().selection, before);
      assert.ok(!dom("return d.body.innerText").includes("Ничего не найдено"));
    } finally {
      browser("network", "unroute", "**/mcp");
    }
    await changed(
      () => button("Повторить запрос"),
      (c) => c.selection.params.page === 2,
    );
  },
);
browser("screenshot", fileURLToPath(new URL("../../artifacts/mcp-browser.png", import.meta.url)));
await mkdir(new URL("../../artifacts/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../../artifacts/browser-verification.json", import.meta.url),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      environment: "Local MCP Apps test host → actual production backend",
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ passed: checks.length }));
