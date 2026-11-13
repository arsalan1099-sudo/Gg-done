const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.resolve(__dirname, "../server/templates/go-saudi.html"), "utf8");

test("Saudi shopper preview has one CSP-compatible inline script with valid JavaScript", () => {
  const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1], {filename: "go-saudi.html:inline.js"}));
});

test("shopper categories open a preview instead of redirecting to seller signup", () => {
  assert.match(html, /id="categorySpotlight"[^>]*hidden/);
  assert.match(html, /id="saveCategory"[^>]*aria-pressed="false"/);
  assert.match(html, /function openCategoryPreview\\(category\\)/);
  assert.match(html, /openCategoryPreview\\(el\\.dataset\\.category\\)/);
  assert.doesNotMatch(html, /document\\.getElementById\\("sell"\\)\\.scrollIntoView/);
  assert.ok(html.indexOf('id="categorySpotlight"') < html.indexOf('id="cities"'));
});

test("four curated themes are explicitly previews with no fake transactions", () => {
  for (const category of ["Grocery", "Fashion", "Home", "Electronics"]) {
    assert.match(html, new RegExp('data-discover="' + category + '"'));
  }
  for (const key of ["discoveryTitle","discoverySubtitle","discoveryDisclosure","pickPreview","spotlightNotice"]) {
    assert.match(html, new RegExp(key + ':"'));
  }
  assert.match(html, /data-i18n="discoveryDisclosure"/);
  assert.match(html, /no real shops or products are live yet/i);
  assert.match(html, /orders and payments are not live/i);
  assert.match(html, /0% sales commission/i);
});

test("saved interests stay device-local and never require purchase", () => {
  assert.match(html, /const savedKey="goSaudiSavedInterestsV1"/);
  assert.match(html, /localStorage\\.setItem\\(savedKey,JSON\\.stringify\\(savedCategories\\)\\)/);
  assert.match(html, /data-i18n="spotlightCity"/);
  assert.match(html, /role="region" aria-label="Category preview"/);
});
