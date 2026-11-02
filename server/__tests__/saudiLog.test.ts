import {test} from "node:test";
import {strict as assert} from "node:assert";
import {saudiErrorCode,logSaudiError} from "../saudiLog";
test("Saudi database errors never log messages, parameters or seller personal data",()=>{
 const secret="0551234567 customer@example.com private invitation";
 const error=Object.assign(new Error(secret),{
   code:"23505",query:"select '"+secret+"'",detail:secret
 });
 assert.equal(saudiErrorCode(error),"Error:23505");
 const messages:string[]=[];
 const original=console.error;
 console.error=(...args:unknown[])=>{messages.push(args.map(String).join(" "))};
 try{logSaudiError("SAUDI_VENDOR",error)}finally{console.error=original}
 const combined=messages.join("\n");
 assert.ok(combined.includes("SAUDI_VENDOR"));
 assert.ok(!combined.includes("0551234567"));
 assert.ok(!combined.includes("customer@example.com"));
 assert.ok(!combined.includes("invitation"));
});
test("untrusted error codes and contexts are redacted",()=>{
 assert.equal(saudiErrorCode({code:"phone=0559999999"}),"Object");
 assert.equal(saudiErrorCode(null),"unknown");
});
