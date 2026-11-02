import {test} from "node:test";
import {strict as assert} from "node:assert";
import fs from "node:fs";
import {Script} from "node:vm";
import {saudiHtmlCsp} from "../saudiCsp";
test("each Saudi HTML document gets an exact inline script hash",()=>{
 for(const file of ["go-saudi.html","go-saudi-admin.html","go-saudi-vendor.html"]){
  const html=fs.readFileSync("server/templates/"+file,"utf8");
  const csp=saudiHtmlCsp(html);
  assert.match(csp,/script-src 'sha256-[A-Za-z0-9+/=]+'/);
  assert.ok(!csp.includes("script-src 'unsafe-inline'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
 }
});
test("extra or missing inline scripts fail closed",()=>{
 assert.throws(()=>saudiHtmlCsp("<p>Missing</p>"));
 assert.throws(()=>saudiHtmlCsp("<script>1</script><script>2</script>"));
});

test("Saudi landing, admin and vendor inline JavaScript must parse",()=>{
 for(const file of ["go-saudi.html","go-saudi-admin.html","go-saudi-vendor.html"]){
  const html=fs.readFileSync("server/templates/"+file,"utf8");
  const scripts=[...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)];
  assert.equal(scripts.length,1,file);
  assert.doesNotThrow(()=>new Script(scripts[0][1],{filename:file}),file);
 }
});
