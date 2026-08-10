import assert from "node:assert/strict";
import test from "node:test";
import { revokeCurrentPushSubscription, savePushSubscription, setLunchPreference, vapidKey } from "../../src/services/customerPushApi.js";

test("vapidKey decodes an unpadded URL-safe application server key", () => {
  globalThis.atob ||= (value) => Buffer.from(value, "base64").toString("binary");
  const raw=Uint8Array.from([4,...Array.from({length:64},(_,index)=>index)]);
  const encoded=Buffer.from(raw).toString("base64url");
  assert.deepEqual(vapidKey(encoded),raw);
});

const response=(status,payload={})=>({ok:status>=200&&status<300,status,json:async()=>payload});

test("subscription persistence uses authenticated CSRF mutation without customer identity",async()=>{
  let request;
  const subscription={endpoint:"https://push.example/device",keys:{p256dh:"key",auth:"auth"}};
  await savePushSubscription(subscription,"csrf",{apiBaseUrl:"https://api.example",fetchImpl:async(...args)=>{request=args;return response(201,{id:"device-id"})}});
  assert.equal(request[0],"https://api.example/api/v1/customer/push/subscriptions");
  assert.equal(request[1].credentials,"include");
  assert.equal(request[1].headers["X-CSRF-Token"],"csrf");
  assert.deepEqual(JSON.parse(request[1].body),subscription);
  assert.equal("customer_user_id" in JSON.parse(request[1].body),false);
});

test("current-device revocation identifies the browser endpoint and account preference is separate",async()=>{
  const requests=[];const fetchImpl=async(...args)=>{requests.push(args);return response(args[1].method==="POST"?204:200,{lunch_special_enabled:false})};
  await revokeCurrentPushSubscription("https://push.example/device","csrf",{fetchImpl});
  await setLunchPreference(false,"csrf",{fetchImpl});
  assert.deepEqual(JSON.parse(requests[0][1].body),{endpoint:"https://push.example/device"});
  assert.deepEqual(JSON.parse(requests[1][1].body),{lunch_special_enabled:false});
});
