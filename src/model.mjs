// Tokyo Ghoul Tracker — pure data model; spec: docs/SPEC.md
export const STORAGE_KEY = "tokyo-ghoul-tracker.v1";
export const OUTCOMES = Object.freeze(["pending","hit","miss"]);
const integer = n => Number.isSafeInteger(n) && n >= 0;
const id = prefix => prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,10);
const iso = () => new Date().toISOString();

export function newSession(date = new Date().toLocaleDateString("sv-SE")) {
  return {schemaVersion:1, meta:{date,hall:"",machine:""}, events:[]};
}

export function validateSession(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== 1 ||
      !value.meta || typeof value.meta !== "object" || !Array.isArray(value.events) ||
      value.events.length > 10000) throw new Error("データ形式またはバージョンが正しくありません。");
  const {date,hall,machine} = value.meta;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof hall !== "string" || hall.length > 120 ||
      typeof machine !== "string" || machine.length > 60) throw new Error("実戦情報が正しくありません。");
  const seen = new Set();
  const czById = new Map(), linked = new Set();
  for (const e of value.events) {
    if (!e || typeof e !== "object" || typeof e.id !== "string" ||
        !/^[a-z0-9_-]{3,80}$/i.test(e.id) || seen.has(e.id) ||
        typeof e.at !== "string" || !Number.isFinite(Date.parse(e.at)))
      throw new Error("イベントのID・日時が不正です。");
    seen.add(e.id);
    if (e.type === "cz") {
      if (!integer(e.games) || !(e.lcdGames === undefined || e.lcdGames === null || integer(e.lcdGames)) || !OUTCOMES.includes(e.outcome))
        throw new Error("CZ記録のG数・結果が不正です。");
      czById.set(e.id,e);
    } else if (e.type === "at") {
      if (!integer(e.coins) || !(e.sourceCzId === null || typeof e.sourceCzId === "string"))
        throw new Error("AT記録の獲得枚数・参照が不正です。");
      if (e.sourceCzId !== null) {
        if (!czById.has(e.sourceCzId) || czById.get(e.sourceCzId).outcome !== "hit" ||
            linked.has(e.sourceCzId)) throw new Error("ATとCZの対応関係が不正です。");
        linked.add(e.sourceCzId);
      }
    } else throw new Error("未対応のイベント種別です。");
  }
  return {schemaVersion:1,meta:{date,hall,machine},events:value.events.map(e =>
    e.type === "cz"
      ? {id:e.id,type:"cz",games:e.games,lcdGames:e.lcdGames ?? null,outcome:e.outcome,at:e.at}
      : {id:e.id,type:"at",coins:e.coins,sourceCzId:e.sourceCzId,at:e.at}
  )};
}

export function withMeta(record, patch) {
  return validateSession({...record,meta:{...record.meta,...patch}});
}
export function addCZ(record,games,outcome="pending",lcdGames=null) {
  if (!integer(games) || !(lcdGames === null || integer(lcdGames)) || !OUTCOMES.includes(outcome)) throw new Error("CZのG数・結果を確認してください。");
  return validateSession({...record,events:[...record.events,{id:id("cz"),type:"cz",games,lcdGames,outcome,at:iso()}]});
}
export function addAT(record,coins) {
  if (!integer(coins)) throw new Error("AT獲得枚数は0以上の整数で入力してください。");
  const linked = new Set(record.events.filter(e=>e.type==="at" && e.sourceCzId).map(e=>e.sourceCzId));
  const source = record.events.find(e=>e.type==="cz" && e.outcome==="hit" && !linked.has(e.id));
  return validateSession({...record,events:[...record.events,{
    id:id("at"),type:"at",coins,sourceCzId:source?.id ?? null,at:iso()
  }]});
}
export function setCZOutcome(record,czId,outcome) {
  if (!OUTCOMES.includes(outcome)) throw new Error("CZ結果が不正です。");
  const original = record.events.find(e=>e.id===czId && e.type==="cz");
  if (!original) throw new Error("CZが見つかりません。");
  if (outcome!=="hit" && record.events.some(e=>e.type==="at" && e.sourceCzId===czId))
    throw new Error("AT紐付け済みです。先にAT記録を削除してください。");
  return validateSession({...record,events:record.events.map(e=>e.id===czId?{...e,outcome}:e)});
}
export function removeEvent(record,eventId) {
  const target = record.events.find(e=>e.id===eventId);
  if (!target) return record;
  return validateSession({...record,events:record.events.filter(e =>
    e.id!==eventId && !(target.type==="cz" && e.type==="at" && e.sourceCzId===eventId)
  )});
}
export function summary(record) {
  const cz = record.events.filter(e=>e.type==="cz");
  const at = record.events.filter(e=>e.type==="at");
  const games = cz.reduce((n,e)=>n+e.games,0), coins = at.reduce((n,e)=>n+e.coins,0);
  return {
    cz:cz.length,hit:cz.filter(e=>e.outcome==="hit").length,
    miss:cz.filter(e=>e.outcome==="miss").length,
    pending:cz.filter(e=>e.outcome==="pending").length,
    games,averageGames:cz.length?games/cz.length:null,
    at:at.length,coins,averageCoins:at.length?coins/at.length:null,
    unlinkedAt:at.filter(e=>!e.sourceCzId).length
  };
}
export function buildAiText(record) {
  const r=validateSession(record), s=summary(r);
  const label={pending:"未確定",hit:"成功",miss:"失敗"};
  const czNumbers = new Map();
  const attached = new Map();
  let czIndex = 0;
  for (const e of r.events) {
    if (e.type === "cz") czNumbers.set(e.id, ++czIndex);
    else if (e.sourceCzId) attached.set(e.sourceCzId, e);
  }
  const rows = [];
  for (const e of r.events) {
    if (e.type === "cz") {
      rows.push(`CZ #${czNumbers.get(e.id)}：実G ${e.games}G / 液晶G ${e.lcdGames === null ? "未記録" : e.lcdGames + "G"} / 結果 ${label[e.outcome]}`);
      const at = attached.get(e.id);
      if (at) rows.push(`  └ AT終了：表示獲得 ${at.coins}枚 / CZ #${czNumbers.get(e.id)}経由`);
    } else if (!e.sourceCzId) {
      rows.push(`AT終了：表示獲得 ${e.coins}枚 / 契機その他/不明`);
    }
  }
  const val = n => n===null?"データなし":n.toFixed(1);
  return [
    "【L東京喰種 実戦入力データ】",
    `日付：${r.meta.date} / 店舗：${r.meta.hall || "未入力"} / 台番号：${r.meta.machine || "未入力"}`,
    "",
    "【集計】",
    `CZ ${s.cz}回（成功${s.hit}・失敗${s.miss}・未確定${s.pending}）`,
    `記録した通常G区間合計 ${s.games}G / CZ当選までの記録区間平均 ${val(s.averageGames)}G`,
    `AT終了記録 ${s.at}回 / 表示獲得枚数計 ${s.coins}枚 / 平均 ${val(s.averageCoins)}枚`,
    "",
    "【時系列記録】",
    ...(rows.length?rows:["記録なし"]),
    "",
    "【入力定義・注意】",
    "実G＝データカウンター側の実消化G数。液晶G＝スイカ加算込みの液晶右下のCZ間ゲーム数。混同しないでください。",
    "CZの実G＝前の記録起点からそのCZ当選までの通常時消化G（CZ・AT中は含まず）。",
    "途中着席・記録漏れ・最後の未記録区間があり得るため、上記G合計は台の総回転数や完全なCZ当選分母とは限りません。",
    "AT獲得枚数＝AT終了画面等の表示獲得枚数で、差枚ではありません。その他/不明は直撃確定を意味しません。",
    "",
    "【分析依頼】",
    "設定差がある根拠とない根拠を分け、CZ当選までの記録G・結果・AT記録を独立に評価してください。",
    "未記録区間とサンプル数の不確実性を明示し、ATの獲得枚数だけで高設定と判定しないでください。"
  ].join("\n");
}
