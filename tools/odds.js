// 每張卡的出現機率：node tools/odds.js
// A：開場（只有粉筆）三選一時，這張卡在三張裡的機率；B：實際玩一關（機器人）時，每次三選一有這張的比例；C：一局裡至少遇到一次的比例
require('../js/data.js'); require('../js/core.js'); require('../js/bot.js');
const { CORE, DATA, BOT } = globalThis;
const K = Object.keys(DATA.SKILLS);
const A = {}, B = {}, C = {};
const S0 = CORE.create(0, { seed: 1 }); const N = 100000;
for (let i = 0; i < N; i++) for (const k of CORE.makeOffer(S0)) A[k] = (A[k] || 0) + 1;
let offers = 0, runs = 0;
for (const li of [0, 1, 2, 3, 4]) for (let s = 1; s <= 12; s++) {
  const S = CORE.create(li, { seed: s * 977 + li }); const seen = new Set(); runs++;
  while (S.t < 400 && S.state !== 'dead' && S.state !== 'clear') {
    S.input = BOT(S); CORE.step(S, 1 / 60); S.ev.length = 0;
    if (S.state === 'pick') { offers++; for (const k of S.offer) { B[k] = (B[k] || 0) + 1; seen.add(k); } const k = S.offer[(S.rng() * 3) | 0] || S.offer[0]; CORE.choose(S, k, CORE.needDrop(S, k) ? CORE.weapons(S)[0] : undefined); }
  }
  for (const k of seen) C[k] = (C[k] || 0) + 1;
}
const rows = K.map((k) => { const s = DATA.SKILLS[k]; return { k, name: s.name, tier: s.kind === 'w' ? DATA.RARE[s.rare].name : '道具', a: (A[k] || 0) / N * 100, b: (B[k] || 0) / offers * 100, c: (C[k] || 0) / runs * 100 }; });
rows.sort((x, y) => y.a - x.a);
console.log('名稱\t稀有度\tA開場\tB每次選卡\tC一局遇到');
for (const r of rows) console.log(`${r.name}\t${r.tier}\t${r.a.toFixed(1)}%\t${r.b.toFixed(1)}%\t${r.c.toFixed(0)}%`);
console.log(`（B、C：5 關各 12 局、亂選卡，共 ${offers} 次選卡）`);
