import {test} from "node:test";
import {strict as assert} from "node:assert";
import {saudiMainCategories,saudiSubcategories,isSaudiSubcategory,matchesSaudiCategory,subcategoriesFor} from "../../lib/saudiCategories";
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

test("Go Bharat-inspired Saudi taxonomy has five main groups and 109 translated subcategories",()=>{
 assert.deepEqual(saudiMainCategories.map(g=>g.id),["b2b","b2c","service","manpower","travel"]);
 assert.equal(saudiSubcategories.length,109);
 assert.equal(new Set(saudiSubcategories.map(x=>x.id)).size,109);
 for(const c of saudiSubcategories){
  assert.ok(c.en&&c.ar&&c.emoji);
  assert.ok(saudiMainCategories.some(g=>g.id===c.group));
  assert.equal(isSaudiSubcategory(c.id),true);
 }
 assert.equal(subcategoriesFor("b2b").length,29);
 assert.equal(subcategoriesFor("b2c").length,31);
 assert.equal(subcategoriesFor("service").length,24);
 assert.equal(subcategoriesFor("manpower").length,16);
 assert.equal(subcategoriesFor("travel").length,9);
 assert.equal(isSaudiSubcategory("sc9999"),false);
});
test("subcategory filtering is exact and never guesses a product's specific category",()=>{
 const coffee={...product,subcategoryId:"sc5"};
 assert.equal(safeSaudiProduct(coffee),true);
 assert.equal(safeSaudiProduct({...coffee,subcategoryId:"fake"}),false);
 assert.equal(matchesSaudiCategory(coffee,"b2c","sc5"),true);
 assert.equal(matchesSaudiCategory(coffee,"b2c","sc9"),false);
 assert.equal(matchesSaudiCategory(coffee,"b2b",null),false);
 assert.equal(matchesSaudiCategory(coffee,"b2c",null),true);
 assert.equal(matchesSaudiCategory(product,"b2c","sc5"),false);
 const old={...product,category:"Wholesale"};
 assert.equal(matchesSaudiCategory(old,"b2b",null),true);
 assert.equal(matchesSaudiCategory(old,"b2b","sc19"),false);
});
