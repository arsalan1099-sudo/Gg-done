import {test} from "node:test";
import {strict as assert} from "node:assert";
import {isSaudiLeadStatus,reviewTransition} from "../saudiAdminRules";
const verified={phoneConfirmed:true,businessDocumentsChecked:true,complianceReviewed:true};
test("only explicit Saudi states are recognized",()=>{
  assert.equal(isSaudiLeadStatus("NEW"),true);
  assert.equal(isSaudiLeadStatus("LIVE"),false);
  assert.equal(isSaudiLeadStatus("SUPER_ADMIN"),false);
});
test("new lead must be contacted before document review",()=>{
  assert.equal(reviewTransition("NEW","APPROVED","Verified seller proof",verified).ok,false);
  assert.equal(reviewTransition("NEW","CONTACTED","",{}).ok,true);
  assert.equal(reviewTransition("CONTACTED","UNDER_REVIEW","",{}).ok,true);
  assert.equal(reviewTransition("UNDER_REVIEW","APPROVED","Verified seller proof",verified).ok,true);
});
test("approval requires explicit checklist and reviewer notes",()=>{
  assert.equal(reviewTransition("UNDER_REVIEW","APPROVED","Verified seller proof",{...verified,complianceReviewed:false}).ok,false);
  assert.equal(reviewTransition("UNDER_REVIEW","APPROVED","short",verified).ok,false);
  assert.equal(reviewTransition("UNDER_REVIEW","APPROVED","Documents and consent checked",verified).ok,true);
  assert.equal(reviewTransition("UNDER_REVIEW","REJECTED","Not eligible",{}).ok,true);
  assert.equal(reviewTransition("APPROVED","NEW","",{}).ok,false);
});
test("rejection requires a reason; recontact is permitted",()=>{
  assert.equal(reviewTransition("NEW","REJECTED","",{}).ok,false);
  assert.equal(reviewTransition("REJECTED","CONTACTED","",{}).ok,true);
});
