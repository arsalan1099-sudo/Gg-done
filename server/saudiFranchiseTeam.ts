import crypto from "node:crypto";
import type {Express} from "express";
import rateLimit from "express-rate-limit";
import {pool} from "./db";
import {sendSaudiPage} from "./saudiCsp";
import {logSaudiError} from "./saudiLog";
import {normalizeSaudiMobile} from "./saudiRules";

const digest=(key:string)=>crypto.createHash("sha256").update(key).digest("hex");
const teamPath="/api/saudi/franchise/team";

export function registerSaudiFranchiseTeam(app:Express) {
  app.get("/franchise",(_req,res)=>sendSaudiPage(res,"go-saudi-franchise.html"));
  // The caller has installed the admin authentication middleware on this prefix.
  app.post("/api/saudi/admin/franchises/:city/owner-key",async(req,res)=>{
    const token=crypto.randomBytes(32).toString("hex");
    try {
      const result=await pool.query("UPDATE saudi_city_franchises SET owner_token_hash=$1 WHERE city=$2",[digest(token),req.params.city]);
      if(!result.rowCount)return res.status(404).json({error:"Unknown franchise"});
      return res.json({token});
    } catch(err) {
      logSaudiError("SAUDI_FRANCHISE_KEY",err);
      return res.status(503).json({error:"Could not issue owner key"});
    }
  });
  app.use(teamPath,rateLimit({windowMs:60000,max:80,standardHeaders:true,legacyHeaders:false}),async(req,res,next)=>{
    res.setHeader("Cache-Control","private, no-store");
    const match=/^Bearer ([a-f0-9]{64})$/.exec(req.get("Authorization")||"");
    if(!match)return res.status(401).json({error:"Franchise owner key required"});
    try {
      const hash=digest(match[1]);
      const owner=await pool.query("SELECT city FROM saudi_city_franchises WHERE owner_token_hash=$1",[hash]);
      if(!owner.rowCount)return res.status(401).json({error:"Invalid or expired franchise owner key"});
      res.locals.ownerHash=hash;
      res.locals.city=owner.rows[0].city;
      next();
    } catch(err) {
      logSaudiError("SAUDI_FRANCHISE_AUTH",err);
      return res.status(503).json({error:"Owner login unavailable"});
    }
  });
  app.post([teamPath+"/executive-key",teamPath+"/delivery-key"],async(req,res)=>{
    const token=crypto.randomBytes(32).toString("hex");
    const id=req.body?.memberId;
    if(typeof id!=="string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
      return res.status(400).json({error:"Choose a team member"});
    try {
      const delivery=req.path.endsWith("/delivery-key");
      const assignment=delivery?"delivery_key_hash=$1, latitude=NULL, longitude=NULL, located_at=NULL, parked_until=NULL, push_endpoint=NULL":"executive_key_hash=$1";
      const result=await pool.query(
        `UPDATE saudi_franchise_team t SET ${assignment} FROM saudi_city_franchises f WHERE t.city=f.city AND f.owner_token_hash=$2 AND t.member_id=$3 AND t.role=$4`,
        [digest(token),res.locals.ownerHash,id,delivery?"DELIVERY_PARTNER":"MARKETING_EXECUTIVE"]);
      if(!result.rowCount)return res.status(404).json({error:"No matching team member in your franchise"});
      return res.json({token});
    }catch(err){
      logSaudiError("SAUDI_EXECUTIVE_KEY",err);
      return res.status(503).json({error:"Could not issue executive key"});
    }
  });
  app.get(teamPath,async(_req,res)=>{
    try {
      const team=await pool.query(
        "SELECT t.member_id AS id,t.name,t.mobile,t.role FROM saudi_franchise_team t JOIN saudi_city_franchises f USING(city) WHERE f.owner_token_hash=$1 ORDER BY hired_at DESC,mobile,role",
        [res.locals.ownerHash]);
      return res.json({city:res.locals.city,members:team.rows});
    } catch(err) {
      logSaudiError("SAUDI_FRANCHISE_TEAM",err);
      return res.status(503).json({error:"Could not load team"});
    }
  });
  app.post(teamPath,async(req,res)=>{
    if(process.env.NODE_ENV==="production" && process.env.GO_SAUDI_PRIVACY_APPROVED!=="true")
      return res.status(503).json({error:"Hiring records are closed pending privacy approval"});
    const {name,mobile,role,city}=req.body||{};
    const phone=typeof mobile==="string" && /^[0-9+ ()-]+$/.test(mobile) && normalizeSaudiMobile(mobile);
    if(city!==undefined || typeof name!=="string" || name.trim().length<2 || name.trim().length>120 || !phone ||
       !["MARKETING_EXECUTIVE","DELIVERY_PARTNER"].includes(role))
      return res.status(400).json({error:"Enter a name, Saudi mobile and supported role. Your franchise sets the city."});
    try {
      const result=await pool.query(
        "INSERT INTO saudi_franchise_team(city,name,mobile,role) SELECT city,$2,$3,$4 FROM saudi_city_franchises WHERE owner_token_hash=$1 ON CONFLICT DO NOTHING RETURNING city,name,mobile,role",
        [res.locals.ownerHash,name.trim(),phone,role]);
      if(!result.rowCount)return res.status(409).json({error:"Member already assigned or owner key changed. Refresh your team."});
      return res.status(201).json({member:result.rows[0]});
    } catch(err) {
      logSaudiError("SAUDI_FRANCHISE_HIRE",err);
      return res.status(503).json({error:"Could not record hire"});
    }
  });
}
