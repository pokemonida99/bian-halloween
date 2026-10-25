// 自動遊玩（測試用）：網址加 ?bot 會自己玩；tools/sim.js 也用這個
(function (G) {
  const CORE = G.CORE;
  function botInput(S) {
    const p = S.p, F = CORE.floorY;
    // 目標：最近的未拿物品→寶箱（順路）→撤離點；最後一關有魔王就追著打
    let tg = null;
    const left = S.items.filter((i) => !i.got);
    const dist = (o) => Math.abs(o.x - p.x) + Math.abs(o.f - p.f) * 700;
    if (S.boss && !S.boss.dead) tg = { x: S.boss.x + (S.boss.x > p.x ? -160 : 160), f: S.boss.f };
    else if (left.length) tg = left.sort((a, b) => dist(a) - dist(b))[0];
    else tg = S.exit;
    const ch = S.chests.find((c) => !c.open && c.f === p.f && Math.abs(c.x - p.x) < 500);
    if (ch && !S.boss) tg = ch;
    if (p.lad != null) {
      const l = S.ladders[p.lad];
      return { x: 0, y: tg.f > l.f ? -1 : 1 };
    }
    if (tg.f === p.f) return { x: Math.abs(tg.x - p.x) > 8 ? Math.sign(tg.x - p.x) : 0, y: 0 };
    const up = tg.f > p.f;
    let best = null, bd = Infinity;
    for (const l of S.ladders) if ((up && l.f === p.f) || (!up && l.f === p.f - 1)) { const d = Math.abs(l.x - p.x); if (d < bd) { bd = d; best = l; } }
    if (!best) return { x: 0, y: 0 };
    if (Math.abs(best.x - p.x) > 20) return { x: Math.sign(best.x - p.x), y: 0 };
    return { x: 0, y: up ? -1 : 1 };
  }
  G.BOT = botInput;
})(typeof window !== 'undefined' ? window : globalThis);
