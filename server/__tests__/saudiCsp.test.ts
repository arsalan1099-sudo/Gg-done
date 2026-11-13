import {test} from "node:test";
import {strict as assert} from "node:assert";
import fs from "node:fs";
import {Script} from "node:vm";
import {saudiHtmlCsp,saudiStaticHtmlCsp} from "../saudiCsp";
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
  const opening=html.indexOf("<script>");
  const ending=html.indexOf("</script>",opening+8);
  assert.ok(opening>=0&&ending>opening,file);
  assert.doesNotThrow(()=>new Script(html.slice(opening+8,ending),{filename:file}),file);
 }
});

test("public Saudi prelaunch privacy notice has scriptless CSP and no inherited India policy",()=>{
 const html=fs.readFileSync("server/templates/go-saudi-privacy.html","utf8");
 const csp=saudiStaticHtmlCsp();
 assert.match(csp,/script-src 'none'/);
 assert.ok(!html.toLowerCase().includes("<script"));
 assert.match(html,/Go Saudi/);
 assert.match(html,/Prelaunch/);
 assert.match(html,/Singapore/);
 assert.ok(!/Go Bharat|Digital Personal Data Protection Act, 2023|Aadhaar/i.test(html));
});
