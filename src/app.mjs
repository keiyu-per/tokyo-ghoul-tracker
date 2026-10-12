import {
 STORAGE_KEY,newSession,validateSession,withMeta,addCZ,addAT,
 setCZOutcome,removeEvent,summary,buildAiText
} from "./model.mjs";

const $ = id => document.getElementById(id);
const by = (tag,cls,text) => {
 const node=document.createElement(tag);
 if(cls) node.className=cls;
 if(text!==undefined) node.textContent=String(text);
 return node;
};
const outcomeNames={pending:"未確定",hit:"AT当選",miss:"失敗"};
let record;
let timer;

function toast(message){
 const node=$("toast");
 node.textContent=message;
 node.classList.add("show");
 clearTimeout(timer);
 timer=setTimeout(()=>node.classList.remove("show"),2800);
}
function integerInput(id){
 const raw=$(id).value.trim();
 if(!/^\d+$/.test(raw)) throw new Error("0以上の整数で入力してください。");
 const parsed=Number(raw);
 if(!Number.isSafeInteger(parsed)) throw new Error("入力値が大きすぎます。");
 return parsed;
}
function load(){
 try {
  const data=localStorage.getItem(STORAGE_KEY);
  return data?validateSession(JSON.parse(data)):newSession();
 } catch(err){
  setTimeout(()=>toast("保存データを読めませんでした。新規表示中です。"),0);
  return newSession();
 }
}
function persist(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(record));}
 catch(err){toast("保存できませんでした。JSONバックアップを確認してください。");}
}
function commit(next){
 record=next;
 persist();
 render();
}
function syncMeta(){
 $("sessionDate").value=record.meta.date;
 $("hall").value=record.meta.hall;
 $("machine").value=record.meta.machine;
}
function number(n){return n.toLocaleString("ja-JP");}
function showStat(id,val){$(id).textContent=val;}

function render(){
 const s=summary(record);
 showStat("statCz",number(s.cz));
 showStat("statResults",s.hit+" / "+s.miss);
 showStat("statGames",number(s.games));
 showStat("statAverage",s.averageGames===null?"—":s.averageGames.toFixed(1)+"G");
 showStat("statAt",number(s.at));
 showStat("statCoins",number(s.coins));
 const linked=new Set(record.events.filter(e=>e.type==="at"&&e.sourceCzId).map(e=>e.sourceCzId));
 const unmatched=record.events.filter(e=>e.type==="cz"&&e.outcome==="hit"&&!linked.has(e.id));
 $("pendingInfo").textContent="CZ結果未確定："+s.pending+"件 / AT未記録の成功CZ："+unmatched.length+"件";
 const map=new Map();let czNo=0;
 for(const e of record.events){if(e.type==="cz")map.set(e.id,++czNo);}
 $("atLinkPreview").textContent=unmatched.length?
   "次のAT終了記録は CZ #"+map.get(unmatched[0].id)+" に連携します。":
   "連携先CZなし。ATは「契機その他/不明」で記録します（直撃を意味しません）。";
 showStat("eventCount",record.events.length+" EVENTS");
 const list=$("eventList");
 list.replaceChildren();
 if(!record.events.length){
  list.append(by("p","empty","まだ記録がありません。CZを記録するとここに表示されます。"));
 }
 for(let i=record.events.length-1;i>=0;i--){
  const e=record.events[i];
  const row=by("div","event-item "+e.type);
  const icon=by("div","event-icon",e.type==="cz"?"CZ":"AT");
  const content=by("div","event-content");
  const title= e.type==="cz"?
    "CZ #"+map.get(e.id)+" / 実"+number(e.games)+"G"+(e.lcdGames===null?"":"・液晶"+number(e.lcdGames)+"G"):
    "AT終了 / "+number(e.coins)+"枚";
  content.append(by("div","event-title",title));
  const clock=new Date(e.at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});
  const sub=e.type==="cz"?
    "結果："+outcomeNames[e.outcome]+"　・ "+clock:
    (e.sourceCzId?"CZ #"+map.get(e.sourceCzId)+" 経由":"契機その他/不明")+"　・ "+clock;
  content.append(by("div","event-sub",sub));
  const tools=by("div","event-tools");
  if(e.type==="cz"){
   if(e.outcome!=="hit")tools.append(actionButton("成功","hit",()=>changeOutcome(e.id,"hit")));
   if(e.outcome!=="miss")tools.append(actionButton("失敗","miss",()=>changeOutcome(e.id,"miss")));
   if(e.outcome!=="pending")tools.append(actionButton("未確定","",()=>changeOutcome(e.id,"pending")));
  }
  tools.append(actionButton("削除","delete",()=>deleteEvent(e)));
  content.append(tools);row.append(icon,content);list.append(row);
 }
 $("promptText").value=buildAiText(record);
}
function actionButton(label,klass,handler){
 const b=by("button",klass,label);
 b.type="button";b.addEventListener("click",handler);
 return b;
}
function changeOutcome(id,outcome){
 try{commit(setCZOutcome(record,id,outcome));toast("CZ結果を更新しました。");}
 catch(err){toast(err.message);}
}
function deleteEvent(e){
 const linked=e.type==="cz"&&record.events.some(x=>x.type==="at"&&x.sourceCzId===e.id);
 if(!window.confirm(linked?
   "このCZと、紐付けたAT記録を削除しますか？":
   "この記録を削除しますか？"))return;
 try{commit(removeEvent(record,e.id));toast("記録を削除しました。");}
 catch(err){toast(err.message);}
}
function setOutcome(value){
 $("czOutcome").value=value;
 document.querySelectorAll(".outcome").forEach(btn=>{
  const active=btn.dataset.outcome===value;
  btn.classList.toggle("active",active);
  btn.setAttribute("aria-pressed",String(active));
 });
}
document.querySelectorAll(".outcome").forEach(btn=>
 btn.addEventListener("click",()=>setOutcome(btn.dataset.outcome))
);
$("czForm").addEventListener("submit",ev=>{
 ev.preventDefault();
 try{
  const lcdRaw=$("lcdGames").value.trim();
  const lcdGames=lcdRaw===""?null:integerInput("lcdGames");
  commit(addCZ(record,integerInput("czGames"),$("czOutcome").value,lcdGames));
  $("czGames").value="";$("lcdGames").value="";
  setOutcome("pending");
  toast("CZを記録しました。");
 }catch(err){toast(err.message);}
});
$("atForm").addEventListener("submit",ev=>{
 ev.preventDefault();
 try{
  commit(addAT(record,integerInput("atCoins")));
  $("atCoins").value="";
  toast("AT終了を記録しました。");
 }catch(err){toast(err.message);}
});
for(const id of ["hall","machine"]){
 $(id).addEventListener("input",()=>{
  try{commit(withMeta(record,{[id]:$(id).value}));}
  catch(err){toast(err.message);}
 });
}
$("sessionDate").addEventListener("change",()=>{
 try{commit(withMeta(record,{date:$("sessionDate").value}));}
 catch(err){toast(err.message);syncMeta();}
});
$("copyBtn").addEventListener("click",async()=>{
 const value=buildAiText(record);
 try{
  if(!navigator.clipboard?.writeText)throw new Error("Clipboard API unavailable");
  await navigator.clipboard.writeText(value);
  toast("AI分析用データをコピーしました。");
 }catch(err){
  $("promptText").value=value;
  document.querySelector(".prompt-details").open=true;
  $("promptText").focus();$("promptText").select();
  try{
   if(document.execCommand("copy")){toast("AI分析用データをコピーしました。");return;}
  }catch(ignore){}
  toast("文章を選択しました。手動でコピーしてください。");
 }
});
$("exportBtn").addEventListener("click",()=>{
 try{
  const blob=new Blob([JSON.stringify(record,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="tokyo-ghoul-"+record.meta.date+".json";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast("バックアップを保存しました。");
 }catch(err){toast("JSONを書き出せませんでした。");}
});
$("importBtn").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",async ev=>{
 const file=ev.target.files?.[0];
 if(!file)return;
 try{
  if(file.size>2*1024*1024)throw new Error("ファイルが大きすぎます（上限2MB）。");
  const next=validateSession(JSON.parse(await file.text()));
  if(!window.confirm("今の記録を置き換えて、バックアップを復元しますか？"))return;
  commit(next);syncMeta();toast("JSONから復元しました。");
 }catch(err){toast("復元失敗："+err.message);}
 finally{$("importFile").value="";}
});
$("resetBtn").addEventListener("click",()=>{
 if(!window.confirm("現在の実戦記録を消去します。必要なら先にJSONバックアップしてください。新しい実戦を開始しますか？"))return;
 commit(newSession());syncMeta();$("czGames").value="";$("atCoins").value="";
 setOutcome("pending");toast("新しい実戦を開始しました。");
});

record=load();
syncMeta();
render();
