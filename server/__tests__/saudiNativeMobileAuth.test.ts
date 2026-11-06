import {test} from "node:test";
import {strict as assert} from "node:assert";
import {normalizeSaudiMobile,validateSaudiOtpInput} from "../../lib/saudiAuth";
test("native Saudi +966 field accepts local and international numbers without double prefix",()=>{
 assert.equal(normalizeSaudiMobile("512345678"),"+966512345678");
 assert.equal(normalizeSaudiMobile("0512345678"),"+966512345678");
 assert.equal(normalizeSaudiMobile("+966512345678"),"+966512345678");
 assert.equal(normalizeSaudiMobile(" 5 123 456 78 "),"+966512345678");
 for(const value of ["+966+966512345678","00966512345678","123456789","+919876543210","000000000",""]){
  assert.equal(normalizeSaudiMobile(value),null,value);
 }
});
test("OTP codes are never generated locally or accepted with nondigits",()=>{
 assert.equal(validateSaudiOtpInput("123456"),true);
 assert.equal(validateSaudiOtpInput("1234"),true);
 for(const value of ["12","1234567x","00000000000","","foo"])assert.equal(validateSaudiOtpInput(value),false);
});
