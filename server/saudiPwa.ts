import path from "node:path";
import type {Express} from "express";

/** Only these public, non-personal assets are served by the PWA routes. */
export function registerSaudiPwa(app: Express): void {
  const directory=path.resolve(process.cwd(),"server/public/pwa");
  const files: Record<string,[string,string]>={
    "/manifest.webmanifest":["manifest.webmanifest","application/manifest+json"],
    "/sw.js":["sw.js","application/javascript"],
    "/offline.html":["offline.html","text/html"],
    "/pwa/icon-192.png":["icon-192.png","image/png"],
    "/pwa/icon-512.png":["icon-512.png","image/png"],
    "/pwa/icon-maskable-512.png":["icon-maskable-512.png","image/png"],
    "/pwa/apple-touch-icon.png":["apple-touch-icon.png","image/png"]
  };
  for(const name of ["home","fashion","grocery","tech"]){
    app.get("/editorial/"+name+".jpg",(_req,res)=>{
      res.setHeader("Cache-Control","public, max-age=86400");
      res.type("image/jpeg").sendFile(path.resolve(process.cwd(),"server/public/editorial",name+".jpg"));
    });
  }
  for(const [url,[file,type]] of Object.entries(files)){
    app.get(url,(_req,res)=>{
      res.setHeader("Cache-Control","no-cache");
      res.setHeader("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      if(url==="/sw.js")res.setHeader("Service-Worker-Allowed","/");
      res.type(type).sendFile(path.join(directory,file));
    });
  }
}
