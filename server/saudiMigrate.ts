import fs from "node:fs";
import path from "node:path";
import {Pool} from "pg";

if(process.env.GO_SAUDI_MODE!=="true")throw Error("GO_SAUDI_MODE=true required for Saudi database migration");
if(!process.env.DATABASE_URL)throw Error("Dedicated Saudi DATABASE_URL is required");
const dbname=new URL(process.env.DATABASE_URL).pathname.replace(/^\//,"");
if(!dbname||/go[_-]?bharat|gg[_-]?done/i.test(dbname))
 throw Error("Refusing to run Saudi migration against a Go Bharat database name");
const sqlText=fs.readFileSync(path.resolve(process.cwd(),"migrations/saudi/001_init.sql"),"utf8");
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
try{
 await pool.query(sqlText);
 const metadata=await pool.query("SELECT market,schema_version FROM saudi_market_metadata WHERE market='go-saudi'");
 if(metadata.rows[0]?.schema_version!==1)throw Error("Saudi metadata verification failed");
 console.log("[SAUDI_DB] Migration 001 applied and dedicated database marker verified");
}finally{await pool.end();}
