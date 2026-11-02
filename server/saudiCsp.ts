import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {Response} from "express";

/** Hash one checked-in inline script, rather than permitting arbitrary inline JS. */
export function saudiHtmlCsp(html: string): string {
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  if(scripts.length!==1) throw new Error("Saudi page must contain exactly one inline script");
  const digest=crypto.createHash("sha256").update(scripts[0][1],"utf8").digest("base64");
  return [
    "default-src 'none'",
    "script-src 'sha256-"+digest+"'",
    "style-src 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
}
export function sendSaudiPage(res:Response, name:"go-saudi.html"|"go-saudi-admin.html"|"go-saudi-vendor.html"):void {
  const safePath=path.resolve(process.cwd(),"server","templates",name);
  const html=fs.readFileSync(safePath,"utf8");
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("Content-Security-Policy",saudiHtmlCsp(html));
  res.type("html").send(html);
}
