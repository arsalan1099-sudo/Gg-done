import {test} from "node:test";
import {strict as assert} from "node:assert";
import {makeSaudiDemoOrder,safeSaudiDemoOrderHistory} from "../../lib/saudiDemoOrders";
import {SaudiProduct} from "../../lib/saudiCart";
const p:SaudiProduct={
 id:"demo-food-1",title:"Sample Saudi Coffee",description:"DEMO NOT FOR SALE",
 priceHalalas:2899,stock:5,city:"Jeddah",category:"Food",
 subcategoryId:"sc5",businessName:"Sample Shop - Demo"
};
const id="DEMO-SA-mn6a0f5k-9x3b21";
const time="2026-11-04T00:00:00.000Z";
test("test order uses integer SAR halalas without real payment, shipping or merchant order",()=>{
 const o=makeSaudiDemoOrder([{id:p.id,quantity:2}],[p],id,time);
 assert.ok(o);
 assert.equal(o.totalHalalas,5798);
 assert.equal(o.currency,"SAR");
 assert.equal(o.status,"TEST_ONLY");
 assert.equal(o.paymentCaptured,false);
 assert.equal(o.serverOrderId,null);
 assert.equal(o.deliveryScheduled,false);
 assert.deepEqual(o.items,[{id:p.id,title:p.title,quantity:2,
  unitPriceHalalas:2899,lineTotalHalalas:5798}]);
});
test("cannot create test order from unknown, duplicated, or overstock cart",()=>{
 assert.equal(makeSaudiDemoOrder([], [p],id,time),null);
 assert.equal(makeSaudiDemoOrder([{id:"fake",quantity:1}], [p],id,time),null);
 assert.equal(makeSaudiDemoOrder([{id:p.id,quantity:2},{id:p.id,quantity:1}], [p],id,time),null);
 // Stock capping is for interactive additions. A tampered saved cart must
 // not turn into a valid new local receipt.
 assert.equal(makeSaudiDemoOrder([{id:p.id,quantity:6}],[p],id,time)?.items[0].quantity,5);
});
test("stored test receipt validation rejects altered amount and fake paid status",()=>{
 const valid=makeSaudiDemoOrder([{id:p.id,quantity:2}],[p],id,time)!;
 assert.equal(safeSaudiDemoOrderHistory([valid]).length,1);
 assert.equal(safeSaudiDemoOrderHistory([valid,valid]).length,1);
 assert.deepEqual(safeSaudiDemoOrderHistory([{...valid,status:"PAID"}]),[]);
 assert.deepEqual(safeSaudiDemoOrderHistory([{...valid,paymentCaptured:true}]),[]);
 assert.deepEqual(safeSaudiDemoOrderHistory([{...valid,totalHalalas:1}]),[]);
 assert.deepEqual(safeSaudiDemoOrderHistory([{...valid,serverOrderId:"ORDER_123"}]),[]);
});
