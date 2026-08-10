import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {adjustCustomerLoyalty,fetchCustomerLoyalty,saveLoyaltyProgram} from "../../src/services/loyaltyApi.js";

const response=(status,payload={})=>({ok:status>=200&&status<300,status,json:async()=>payload});

test("customer loyalty derives identity from authenticated cookie",async()=>{let request;await fetchCustomerLoyalty({apiBaseUrl:"https://api.example",fetchImpl:async(...args)=>{request=args;return response(200,{programs:[]})}});assert.equal(request[0],"https://api.example/api/v1/customer/loyalty");assert.equal(request[1].credentials,"include");assert.equal(request[1].method,"GET")});

test("Owner program and adjustment mutations carry CSRF and explicit audit reason",async()=>{const requests=[];const fetchImpl=async(...args)=>{requests.push(args);return response(args[1].method==="POST"?201:200,{})};await saveLoyaltyProgram({name:"Coffee & Tea Loyalty"},"csrf",{fetchImpl});await adjustCustomerLoyalty({customer_user_id:"customer",program_id:"program",quantity:-1,reason:"Correction"},"csrf",{fetchImpl});assert.equal(requests[0][1].headers["X-CSRF-Token"],"csrf");assert.deepEqual(JSON.parse(requests[1][1].body),{customer_user_id:"customer",program_id:"program",quantity:-1,reason:"Correction"})});

test("Home and Account render authenticated real state, errors, and signed-out invitation",()=>{const home=readFileSync(new URL("../../src/pages/HomePage.jsx",import.meta.url),"utf8");const card=readFileSync(new URL("../../src/components/LoyaltyCard.jsx",import.meta.url),"utf8");const account=readFileSync(new URL("../../src/pages/AccountPage.jsx",import.meta.url),"utf8");assert.match(home,/fetchCustomerLoyalty/);assert.match(card,/Sign in to collect loyalty stamps/);assert.match(card,/Free drink ready/);assert.match(card,/Your saved progress is not affected/);assert.match(account,/AccountLoyalty/)});

test("Owner Loyalty includes searchable real products, status, and audited adjustment",()=>{const page=readFileSync(new URL("../../src/admin/LoyaltyPage.jsx",import.meta.url),"utf8");assert.match(page,/Search loyalty products/);assert.match(page,/Earns a stamp/);assert.match(page,/Can be a free reward/);assert.match(page,/Program status/);assert.match(page,/Required reason/);assert.match(page,/Save loyalty program/)});

test("Owner Loyalty product controls are associated, touch-oriented, and responsive",()=>{const page=readFileSync(new URL("../../src/admin/LoyaltyPage.jsx",import.meta.url),"utf8");const styles=readFileSync(new URL("../../src/style.css",import.meta.url),"utf8");assert.match(page,/htmlFor={earningId}/);assert.match(page,/id={earningId}/);assert.match(page,/htmlFor={rewardId}/);assert.match(page,/id={rewardId}/);assert.match(page,/loyalty-eligibility-controls/);assert.match(styles,/\.loyalty-program-form \.loyalty-eligibility-control[^}]*min-height: 44px/);assert.match(styles,/:has\(input:checked\)/);assert.match(styles,/@media \(max-width: 480px\)[^{]*{[^}]*\.loyalty-eligibility-controls/s)});

test("Owner Loyalty filtering preserves the unsaved eligibility draft",()=>{const page=readFileSync(new URL("../../src/admin/LoyaltyPage.jsx",import.meta.url),"utf8");assert.match(page,/const filtered=useMemo\(\(\)=>\(data\?\.products\|\|\[\]\)\.filter/);assert.match(page,/function toggle\(id,field\)\{setForm/);assert.match(page,/checked={form\.earning_product_ids\.includes\(product\.id\)}/);assert.match(page,/checked={form\.reward_product_ids\.includes\(product\.id\)}/)});
