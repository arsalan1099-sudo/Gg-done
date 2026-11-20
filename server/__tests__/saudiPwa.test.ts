import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import express from "express";
import {registerSaudiPwa} from "../saudiPwa";
import {sendSaudiPage} from "../saudiCsp";

test("PWA routes serve the manifest, valid PNG sizes and CSP-compatible app",async()=>{
  const app=express();registerSaudiPwa(app);
  app.get("/",(_req,res)=>sendSaudiPage(res,"go-saudi.html"));
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const address=server.address() as {port:number};
  const base=`http://127.0.0.1:${address.port}`;
  try{
    const response=await fetch(base+"/manifest.webmanifest");
    assert.match(response.headers.get("content-type")!,/application\/manifest\+json/);
    const manifest=await response.json();assert.equal(manifest.display,"standalone");
    assert.equal(manifest.start_url,"/");assert.equal(manifest.scope,"/");
    for(const icon of [...manifest.icons,{src:"/pwa/apple-touch-icon.png",sizes:"180x180"}]){
      const result=await fetch(base+icon.src);assert.equal(result.status,200);
      assert.match(result.headers.get("content-type")!,/image\/png/);
      const bytes=Buffer.from(await result.arrayBuffer());
      assert.equal(bytes.subarray(1,4).toString(),"PNG");
      assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);
    }
    const home=await fetch(base+"/");const csp=home.headers.get("content-security-policy")!;
    assert.match(csp,/manifest-src 'self'/);assert.match(csp,/worker-src 'self'/);
    assert.match(csp,/script-src 'sha256-/);assert.doesNotMatch(csp,/script-src 'unsafe-inline'/);
    const sw=await fetch(base+"/sw.js");assert.equal(sw.headers.get("service-worker-allowed"),"/");
    assert.equal(sw.headers.get("cache-control"),"no-cache");
    assert.match(await (await fetch(base+"/offline.html")).text(),/You're offline/);
    assert.equal((await fetch(base+"/pwa/unknown.png")).status,404);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

function workerHarness(networkFails=false){
  const handlers:Record<string,Function>={};const added:string[]=[];const deleted:string[]=[];
  const context={
    URL,Response,
    self:{location:{origin:"https://example.test"},clients:{claim:async()=>{}},addEventListener:(name:string,fn:Function)=>{handlers[name]=fn}},
    caches:{open:async()=>({addAll:async(urls:string[])=>added.push(...urls),match:async(url:string)=>new Response("OFFLINE:"+url)}),
      keys:async()=>["go-saudi-public-v0","go-saudi-public-v1","other-app-cache"],delete:async(name:string)=>deleted.push(name)},
    fetch:async()=>{if(networkFails)throw Error("offline");return new Response("LIVE")}
  };
  vm.runInNewContext(fs.readFileSync("server/public/pwa/sw.js","utf8"),context);
  const request=(path:string,method="GET",mode="navigate")=>{
    let response:Promise<Response>|undefined;
    handlers.fetch({request:{url:new URL(path,"https://example.test").href,method,mode},respondWith:(value:Promise<Response>)=>{response=value}});
    return response;
  };
  return {handlers,added,deleted,request};
}
test("worker bypasses APIs, accounts, cross-origin and write requests",()=>{
  const h=workerHarness();
  for(const path of ["/api/health","/api/saudi/orders","/vendor","/admin","/privacy","https://other.test/"]){assert.equal(h.request(path),undefined,path);}
  assert.equal(h.request("/","POST"),undefined);
  assert.equal(h.request("/pwa/icon-192.png?private=1","GET","cors"),undefined);
});
test("offline navigations show a notice; online responses stay fresh",async()=>{
  assert.equal(await (await workerHarness().request("/")!).text(),"LIVE");
  for(const path of ["/","/sell"]){assert.equal(await (await workerHarness(true).request(path)!).text(),"OFFLINE:/offline.html");}
});
test("worker caches only public assets and cleans up only its own old caches",async()=>{
  const h=workerHarness();let work:Promise<unknown>|undefined;
  h.handlers.install({waitUntil:(p:Promise<unknown>)=>work=p});await work;
  assert.ok(h.added.includes("/offline.html"));
  assert.ok(h.added.every(url=>url==="/offline.html"||url.startsWith("/pwa/")));
  h.handlers.activate({waitUntil:(p:Promise<unknown>)=>work=p});await work;
  assert.deepEqual(h.deleted,["go-saudi-public-v0"]);
});
