// 自動遊玩機器人：每關跑多個亂數種子，看通關率、花多久、幾級（改 data.js 數值後跑）
// node tools/sim.js [關卡 1～5] ；SEEDS=20 加測；PICK=random 亂選卡（預設照常見玩法挑）
require('../js/data.js'); require('../js/core.js'); require('../js/bot.js');
const { CORE, DATA, BOT: botInput } = globalThis;
const SEEDS = +(process.env.SEEDS || 8);
const only = process.argv[2] ? [+process.argv[2] - 1] : DATA.LEVELS.map((_, i) => i);
const PREF = ['glow', 'candy', 'bomb', 'thunder', 'flash', 'beam', 'buddy', 'brew', 'cape', 'bento', 'frost', 'shoe', 'magnet', 'clock'];

function run(li, seed) {
  const S = CORE.create(li, { seed: seed * 7919 + 13 });
  const dt = 1 / 60;
  let picks = [];
  while (S.t < 600) {
    S.input = botInput(S);
    CORE.step(S, dt);
    S.ev.length = 0;
    if (S.state === 'pick') {
      let k = S.offer[0];
      if (process.env.PICK !== 'random') k = S.offer.slice().sort((a, b) => PREF.indexOf(a) - PREF.indexOf(b))[0];
      else k = S.offer[(S.rng() * S.offer.length) | 0];
      picks.push(k); CORE.choose(S, k);
    }
    if (S.state === 'dead' || S.state === 'clear') break;
  }
  return { ok: S.state === 'clear', t: S.t, lv: S.p.lv, hp: Math.round(S.p.hp), kills: S.kills, items: S.items.filter((i) => i.got).length, maxMons: 0, picks };
}

for (const li of only) {
  const rs = []; for (let s = 1; s <= SEEDS; s++) rs.push(run(li, s));
  const ok = rs.filter((r) => r.ok);
  const avg = (a, f) => a.length ? (a.reduce((s, r) => s + f(r), 0) / a.length).toFixed(0) : '-';
  console.log(`第${li + 1}關 ${DATA.LEVELS[li].name}：過關 ${ok.length}/${rs.length}  過關平均 ${avg(ok, (r) => r.t)} 秒、Lv${avg(ok, (r) => r.lv)}、剩血 ${avg(ok, (r) => r.hp)}  ` +
    `失敗：${rs.filter((r) => !r.ok).map((r) => `${r.t.toFixed(0)}s/${r.items}件/Lv${r.lv}`).join(' ')}  擊倒平均 ${avg(rs, (r) => r.kills)}`);
}
