import {test} from "node:test";
import {strict as assert} from "node:assert";
import {draftProduct, safeVendorToken,sha256Token,safeShopDescription} from "../saudiVendorRules";
test("vendor tokens must be exact 64-character lowercase hex",()=>{
 assert.equal(safeVendorToken("a".repeat(64)),true);
 assert.equal(safeVendorToken("a".repeat(32)),false);
 assert.equal(safeVendorToken("A".repeat(64)),false);
 assert.equal(sha256Token("a".repeat(64)).length,64);
});
test("validate draft pricing in integer Saudi halalas",()=>{
 const v={title:"Saudi coffee",description:"Local roast",priceHalalas:2550,stock:9};
 assert.equal(draftProduct(v).ok,true);
 assert.equal(draftProduct({...v,priceHalalas:25.5}).ok,false);
 assert.equal(draftProduct({...v,priceHalalas:0}).ok,false);
 assert.equal(draftProduct({...v,stock:-1}).ok,false);
 assert.equal(draftProduct({...v,title:"  "}).ok,false);
 assert.equal(draftProduct({...v,subcategoryId:"sc5"}).ok,true);
 assert.equal(draftProduct({...v,subcategoryId:"sc9999"}).ok,false);
 assert.equal(draftProduct({...v,subcategoryId:5}).ok,false);
 assert.equal(draftProduct({...v,stock:1000001}).ok,false);
});
test("shop description bounded",()=>{
 assert.equal(safeShopDescription("  Coffee store   "),"Coffee store");
 assert.equal(safeShopDescription("x".repeat(601)),null);
 assert.equal(safeShopDescription({}),null);
});
