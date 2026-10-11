import test from "node:test";
import assert from "node:assert/strict";
import {
 newSession,addCZ,addAT,setCZOutcome,removeEvent,summary,
 validateSession,buildAiText,withMeta
} from "../src/model.mjs";

test("A01: CZ 150G成功・200G失敗 → 区間平均175G",()=>{
 let r=newSession("2026-10-12");
 r=addCZ(r,150,"hit");
 r=addCZ(r,200,"miss");
 assert.deepEqual([summary(r).cz,summary(r).hit,summary(r).games,summary(r).averageGames],[2,1,350,175]);
});
test("A02: AT終了は未連携の成功CZにリンクし、枚数集計",()=>{
 let r=addCZ(newSession("2026-10-12"),150,"hit");
 r=addAT(r,1200);
 assert.equal(r.events[1].sourceCzId,r.events[0].id);
 assert.equal(summary(r).coins,1200);
});
test("A03: 未確定CZを成功へ確定",()=>{
 let r=addCZ(newSession("2026-10-12"),80,"pending");
 r=setCZOutcome(r,r.events[0].id,"hit");
 assert.deepEqual([summary(r).hit,summary(r).pending],[1,0]);
});
test("A04: CZ削除で紐付けATも削除",()=>{
 let r=addAT(addCZ(newSession("2026-10-12"),160,"hit"),300);
 r=removeEvent(r,r.events[0].id);
 assert.equal(r.events.length,0);
});
test("A05: 空・負数・小数・NaN・Infinityを拒否",()=>{
 const r=newSession("2026-10-12");
 for(const bad of [undefined,null,-1,1.5,NaN,Infinity,"", "123"]) {
   assert.throws(()=>addCZ(r,bad,"hit"));
   assert.throws(()=>addAT(r,bad));
 }
});
test("A06/A08: 正当なJSON往復と不正なJSON復元の拒否",()=>{
 let r=addAT(addCZ(withMeta(newSession("2026-10-12"),{hall:"北千住",machine:"11"}),219,"hit"),760);
 assert.deepEqual(validateSession(JSON.parse(JSON.stringify(r))),r);
 const broken=structuredClone(r);
 broken.events[1].sourceCzId="absent";
 assert.throws(()=>validateSession(broken));
 assert.equal(r.events.length,2);
});
test("A07: AI出力は時系列・根拠区別・入力定義を含む",()=>{
 const r=addAT(addCZ(newSession("2026-10-12"),225,"hit"),900);
 const output=buildAiText(r);
 for(const part of ["225通常G","900枚","CZ #1経由","時系列記録","記録漏れ","獲得枚数だけで高設定"]) {
   assert.ok(output.includes(part),part);
 }
});
test("A09: AT契機不明は直撃と断定しない",()=>{
 const r=addAT(newSession("2026-10-12"),200);
 assert.equal(r.events[0].sourceCzId,null);
 assert.match(buildAiText(r),/契機その他\/不明/);
});
test("整合性: 連携ATのある成功CZは失敗へ変更できない",()=>{
 const r=addAT(addCZ(newSession("2026-10-12"),23,"hit"),100);
 assert.throws(()=>setCZOutcome(r,r.events[0].id,"miss"));
});
test("整合性: 同一CZに2件のATをリンクしない",()=>{
 let r=addAT(addCZ(newSession("2026-10-12"),23,"hit"),100);
 r=addAT(r,200);
 assert.equal(r.events[2].sourceCzId,null);
});
