import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import {sql} from "drizzle-orm";
import {createServer} from "node:http";
import {db,pool} from "./db";
import {registerSaudiMarket} from "./saudiMarket";
import {isSaudiAdminKeyConfigured} from "./saudiAdminAuth";

// Dedicated Saudi server: no Go Bharat registration, payments, cron, SPA or
// India admin routes are loaded at startup. Fail closed on missing secrets.
if(process.env.NODE_ENV==="production"){
  if(process.env.GO_SAUDI_MODE!=="true")throw Error("GO_SAUDI_MODE must be true");
  if(!isSaudiAdminKeyConfigured(process.env.GO_SAUDI_ADMIN_TOKEN_SHA256))
    throw Error("GO_SAUDI_ADMIN_TOKEN_SHA256 is required");
  try{
    const publicOrigin=new URL(process.env.APP_PUBLIC_URL||"");
    if(publicOrigin.protocol!=="https:" || publicOrigin.username || publicOrigin.password || publicOrigin.pathname!=="/" ||
      publicOrigin.search || publicOrigin.hash) throw Error("Invalid origin");
  }catch{throw Error("APP_PUBLIC_URL must be an HTTPS origin in production");}
}
const app=express();
app.disable("x-powered-by");
app.set("trust proxy",1); // Render: one trusted ingress proxy
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.use(compression());
app.use(express.json({limit:"32kb",strict:true}));
app.use(express.urlencoded({extended:false,limit:"32kb"}));
app.use(rateLimit({windowMs:60_000,limit:300,standardHeaders:true,legacyHeaders:false}));

// Protect mutating Saudi endpoints against cross-origin browser requests.
// APIs use no permissive CORS. CLI/admin clients without Origin use their
// private bearer token; vendor cookie requests require same-origin Origin.
app.use("/api/saudi",(req,res,next)=>{
  const method=req.method.toUpperCase();
  if(!["POST","PUT","PATCH","DELETE"].includes(method))return next();
  const origin=req.header("Origin");
  const configured=process.env.APP_PUBLIC_URL;
  const own=process.env.NODE_ENV==="production"
    ? configured
    : "http://"+req.get("host");
  if(origin && origin!==own)return res.status(403).json({error:"Cross-origin writes are disabled"});
  next();
});
app.get("/api/health",async(_req,res)=>{
  try{
    await db.execute(sql`select 1 as ok`);
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({status:"healthy",service:"go-saudi",mode:"PRELAUNCH",
      database:"connected",payments:false,orders:false});
  }catch{
    return res.status(503).json({status:"unhealthy",service:"go-saudi",database:"unavailable"});
  }
});
registerSaudiMarket(app);
app.use((_req,res)=>res.status(404).json({error:"Go Saudi route not found"}));
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  // Never return driver errors or PII.
  console.error("[SAUDI_HTTP] Request failed",err instanceof Error?err.name:"Unknown error");
  if(res.headersSent)return;
  return res.status(400).json({error:"Invalid request"});
});
const port=Number(process.env.PORT||"5000");
if(!Number.isInteger(port)||port<1||port>65535)throw Error("Invalid PORT");
const server=createServer(app);
server.listen(port,"0.0.0.0",()=>console.log("[SAUDI] Secure prelaunch server listening",port));
let closing=false;
for(const signal of ["SIGTERM","SIGINT"]){
  process.once(signal,()=>{
    if(closing)return;closing=true;
    server.close(async()=>{try{await pool.end();process.exit(0);}catch{process.exit(1);}});
    setTimeout(()=>process.exit(1),10_000).unref();
  });
}
