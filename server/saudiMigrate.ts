import fs from "node:fs";
import path from "node:path";
import {Pool} from "pg";

async function main(){
  if(process.env.GO_SAUDI_MODE!=="true")throw Error("GO_SAUDI_MODE=true required");
  if(!process.env.DATABASE_URL)throw Error("Dedicated Saudi DATABASE_URL required");
  const dbname=new URL(process.env.DATABASE_URL).pathname.replace(/^\//,"");
  if(!dbname||/go[_-]?bharat|gg[_-]?done/i.test(dbname))
    throw Error("Refusing Saudi migration against Go Bharat database name");
  const migrations=["001_init.sql","002_data_requests.sql","003_catalog.sql","004_subcategories.sql","005_customer_commerce.sql","006_moyasar_webhook_inbox.sql"];
  const sqlTexts=migrations.map(name=>fs.readFileSync(path.resolve(process.cwd(),"migrations/saudi",name),"utf8"));
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
  try{
    for(const sqlText of sqlTexts)await pool.query(sqlText);
    const result=await pool.query("SELECT market,schema_version FROM saudi_market_metadata WHERE market='go-saudi'");
    if(result.rows[0]?.schema_version!==6)throw Error("Saudi metadata verification failed");
    console.log("[SAUDI_DB] Migrations 001–006 applied and isolated DB marker verified");
  }finally{await pool.end()}
}
main().catch(err=>{console.error("[SAUDI_DB] Migration failed:",err instanceof Error?err.message:"Unknown error");process.exitCode=1});
