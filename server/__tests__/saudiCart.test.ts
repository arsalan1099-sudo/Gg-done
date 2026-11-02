import {test} from "node:test";
import {strict as assert} from "node:assert";
import {changeSaudiCart,safeSaudiCart,safeSaudiProduct,saudiCartTotal,sar,SaudiProduct} from "../../lib/saudiCart";
const product:SaudiProduct={id:"demo-abc-1",title:"Saudi Coffee",description:"Demo product",
 priceHalalas:2250,stock:4,category:"Food",city:"Jeddah",businessName:"Demo"};
test("cart quantity cannot exceed real inventory or 20 items",()=>{
 let cart=changeSaudiCart([],product,1);
 assert.equal(cart[0].quantity,1);
 for(let i=0;i<30;i++)cart=changeSaudiCart(cart,product,1);
 assert.equal(cart[0].quantity,4);
 assert.equal(saudiCartTotal(cart,[product]),9000);
 for(let i=0;i<5;i++)cart=changeSaudiCart(cart,product,-1);
 assert.deepEqual(cart,[]);
 assert.equal(saudiCartTotal(cart,[product]),0);
});
test("cart import rejects duplicates, unknown ids, negative values",()=>{
 const list=safeSaudiCart([
  {id:product.id,quantity:100},{id:product.id,quantity:1},
  {id:"demo-unknown",quantity:2},{id:product.id,quantity:-1}
 ],[product]);
 assert.deepEqual(list,[{id:product.id,quantity:4}]);
 assert.deepEqual(safeSaudiCart({},[product]),[]);
});
test("amounts use integer halalas and invalid catalogue entries are rejected",()=>{
 assert.equal(sar(2250),"SAR 22.50");
 assert.equal(safeSaudiProduct(product),true);
 assert.equal(safeSaudiProduct({...product,priceHalalas:-10}),false);
 assert.equal(safeSaudiProduct({...product,id:"../hack"}),false);
 assert.equal(safeSaudiProduct({...product,stock:1.2}),false);
});
