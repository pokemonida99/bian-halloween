// 2D 畫面：夜空、校舍剖面（教室、樓板、梯子）、怪物群、武器特效、傷害數字、指路箭頭；小編由 hero.js 的 3D 貼上來
import * as HERO from './hero.js?v=5';

const CORE = window.CORE, D = window.DATA;
const { W, H, T } = D.ROOM;
const IMG = {};
let cv, ctx, dpr = 1, cssW = 0, cssH = 0, scale = 1;
const nums = [], parts = [];
let shake = 0, flashA = 0, redA = 0;

export function loadImages(tick) {
  const names = ['sky', 'items', 'skills', 'skills2', 'm-pumpkin', 'm-ghost', 'm-bat', 'm-mummy', 'm-boss', 'm-ghostboss',
    ...['class', 'lab', 'library', 'nurse', 'music', 'gym', 'office', 'hall', 'roof'].map((n) => 'room-' + n)];
  return Promise.all(names.map((n) => new Promise((res) => {
    const im = new Image(); im.onload = () => { IMG[n] = im; tick(); res(); }; im.onerror = () => { tick(); res(); };
    im.src = `art/${n}.webp?v=5`;
  }))).then(() => {
    // 怪物的白色、藍色、橘色剪影（被打閃白、被冰變藍、被燙變橘）
    for (const k of ['m-pumpkin', 'm-ghost', 'm-bat', 'm-mummy', 'm-boss', 'm-ghostboss']) {
      const im = IMG[k]; if (!im) continue;
      for (const [suf, col] of [['w', '#fff'], ['b', '#7fd0ff'], ['o', '#ffb347']]) {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
        IMG[k + suf] = c;
      }
    }
  });
}
export const LOAD_STEPS = 20;
export const img = (n) => IMG[n];

export function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); resize(); }
// 直式手機：寬 720 單位剛好塞滿；橫的螢幕看 1000 單位高
export function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = cv.clientWidth || innerWidth || 360; cssH = cv.clientHeight || innerHeight || 640;
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  scale = cssH / cssW >= 1.45 ? cssW / 600 : cssH / 860;
  return { w: cssW / scale, h: cssH / scale };
}
export const toScreen = (S, x, y) => ({ x: (x - S.cam.x) * scale + cssW / 2, y: (y - S.cam.y) * scale + cssH / 2 });

// 遊戲事件 → 特效
export function events(S, evs) {
  for (const e of evs) {
    if (e.k === 'dmg') {
      if (nums.length > 45) nums.shift();
      nums.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y, n: e.n, t: 0, big: e.big, src: e.src });
    } else if (e.k === 'die') burst(e.x, e.y, e.t, e.r);
    else if (e.k === 'hurt') { redA = 0.35; shake = Math.max(shake, 6); nums.push({ x: e.x, y: e.y - 40, n: -e.n, t: 0, hurt: true }); }
    else if (e.k === 'heal') nums.push({ x: e.x, y: e.y - 40, n: '+' + e.n, t: 0, heal: true });
    else if (e.k === 'boom') shake = Math.max(shake, 7);
    else if (e.k === 'flash') flashA = 0.22;
    else if (e.k === 'thunder') shake = Math.max(shake, 4);
    else if (e.k === 'bossDown') { shake = 18; for (let i = 0; i < 6; i++) burst(e.x + (Math.random() - 0.5) * 120, e.y + (Math.random() - 0.5) * 100, 'boss', 60); }
    else if (e.k === 'item' || e.k === 'chest') sparkle(e.it ? e.it.x : e.c.x, (e.it ? e.it.y : e.c.y) - 50);
  }
}
const PCOL = { ghostking: ['#f4f1ea', '#c9b8e8', '#fff'], pumpkin: ['#f08a24', '#ffb347', '#5b8f2e'], bat: ['#5a3d6e', '#2d1f38', '#c43'], ghost: ['#f4f1ea', '#d9d4c8', '#fff'], mummy: ['#e9dfc6', '#c9bc9a', '#fff3c4'], boss: ['#f08a24', '#ffd34d', '#5b8f2e'] };
function burst(x, y, k, r) {
  if (parts.length > 380) parts.splice(0, 40);
  const cols = PCOL[k] || PCOL.pumpkin, n = k === 'boss' ? 18 : 7;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 120 + Math.random() * 260;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 180, t: 0, dur: 0.5 + Math.random() * 0.4, c: cols[i % cols.length], s: 4 + Math.random() * (r / 4), g: 900 });
  }
  parts.push({ x, y, vx: 0, vy: -20, t: 0, dur: 0.4, c: 'puff', s: r * 1.4, g: 0 });
}
function sparkle(x, y) {
  for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; parts.push({ x, y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: 0, dur: 0.6, c: '#ffe08a', s: 5, g: 0, star: true }); }
}

// ---------- 主畫面 ----------
export function draw(S, o) {
  const t = o.t, dt = o.dt;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSky(S);
  shake *= Math.pow(0.02, dt); if (shake < 0.3) shake = 0;
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  const k = dpr * scale;
  ctx.setTransform(k, 0, 0, k, dpr * (cssW / 2 - S.cam.x * scale + sx), dpr * (cssH / 2 - S.cam.y * scale + sy));
  const vw = cssW / scale, vh = cssH / scale;
  const view = { x0: S.cam.x - vw / 2 - 80, x1: S.cam.x + vw / 2 + 80, y0: S.cam.y - vh / 2 - 80, y1: S.cam.y + vh / 2 + 80 };
  drawBuilding(S, view, t);
  drawProps(S, t, o);
  drawPools(S, t);
  drawGems(S, t);
  for (const m of S.mons) if (!m.d.fly) drawMon(S, m, t, view);
  drawPlayer(S, t, o);
  for (const m of S.mons) if (m.d.fly) drawMon(S, m, t, view);
  drawShots(S, t);
  // 夜晚的暗角（小編身邊亮一點）
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pcS = toScreen(S, S.p.x, CORE.pc(S));
  if (!isFinite(pcS.x) || !isFinite(pcS.y)) return;
  const rg = ctx.createRadialGradient(pcS.x, pcS.y, 120 * scale, pcS.x, pcS.y, Math.max(cssW, cssH) * 0.75);
  rg.addColorStop(0, 'rgba(6,8,22,0)'); rg.addColorStop(1, 'rgba(6,8,22,0.55)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, cssW, cssH);
  ctx.setTransform(k, 0, 0, k, dpr * (cssW / 2 - S.cam.x * scale + sx), dpr * (cssH / 2 - S.cam.y * scale + sy));
  drawBeams(S); drawExtras(S, t); drawGlow(S, t); drawHelper(S, t, o);
  ctx.globalCompositeOperation = 'lighter';
  drawFx(S);
  ctx.globalCompositeOperation = 'source-over';
  drawBolts(S, t);
  drawParts(dt);
  drawNums(dt);
  if (!o.story) drawHpBar(S);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!o.story) drawPointer(S, t);
  flashA *= Math.pow(0.004, dt); redA *= Math.pow(0.01, dt);
  if (flashA > 0.01) { ctx.fillStyle = `rgba(255,255,240,${flashA})`; ctx.fillRect(0, 0, cssW, cssH); }
  const low = S.p.hp / S.p.max < 0.3 && S.state === 'play' ? 0.18 + 0.1 * Math.sin(t * 6) : 0;
  const ra = Math.max(redA, low);
  if (ra > 0.01) {
    const g = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.3, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.7);
    g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, `rgba(200,10,10,${ra * 1.6})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cssW, cssH);
  }
  if (o.joy) drawJoy(o.joy);
  if (S.boss && !S.boss.dead) drawBossBar(S, o);
}

function drawSky(S) {
  const im = IMG.sky;
  ctx.fillStyle = '#0d1626'; ctx.fillRect(0, 0, cssW, cssH);
  if (!im) return;
  const s = Math.max(cssW / im.width, cssH / im.height) * 1.15;
  const w = im.width * s, h = im.height * s;
  const px = -(S.cam.x / Math.max(1, S.Wt)) * (w - cssW) * 0.5, py = (S.cam.y / 3000) * (h - cssH) * 0.4;
  ctx.drawImage(im, (cssW - w) / 2 + px * 0.5, (cssH - h) / 2 - py, w, h);
}

const FY = CORE.floorY;
let slabPat = null, wallPat = null;
function pattern(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return ctx.createPattern(c, 'repeat'); }
function drawBuilding(S, v, t) {
  const top = FY(S.F), roofTop = S.rooms[S.F - 1].every((r) => r === 'roof');
  if (!slabPat) {
    slabPat = pattern(64, 40, (g, w, h) => { g.fillStyle = '#4f4b45'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.07)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
    wallPat = pattern(40, 24, (g, w, h) => { g.fillStyle = '#b9b2a2'; g.fillRect(0, 0, w, h); g.fillStyle = '#8f8878'; g.fillRect(0, h - 2, w, 2); g.fillRect(w - 2, 0, 2, h); });
  }
  // 校舍前的操場：草地、紅土跑道、圍籬
  drawYard(v, t);
  ctx.fillStyle = wallPat;
  const wTop = roofTop ? FY(S.F - 1) : top;
  ctx.fillRect(-34, wTop, 34, T - wTop); ctx.fillRect(S.Wt, wTop, 34, T - wTop);
  if (!roofTop) { ctx.fillRect(-34, top - 14, S.Wt + 68, 14); }
  // 教室
  for (let f = 0; f < S.F; f++) {
    const fy = FY(f), y0 = fy - H;
    if (fy < v.y0 || y0 > v.y1) continue;
    for (let c = 0; c < S.C; c++) {
      const x0 = c * W; if (x0 > v.x1 || x0 + W < v.x0) continue;
      const im = IMG['room-' + S.rooms[f][c]];
      if (im) ctx.drawImage(im, x0, y0, W, H); else { ctx.fillStyle = '#33463c'; ctx.fillRect(x0, y0, W, H); }
      ctx.fillStyle = 'rgba(12,18,40,.28)'; ctx.fillRect(x0, y0, W, H);   // 夜晚
      // 教室之間的牆（門框）
      if (c > 0) {
        ctx.fillStyle = '#2d2a26'; ctx.fillRect(x0 - 9, y0, 18, H - 200);
        ctx.fillStyle = '#4a453e'; ctx.fillRect(x0 - 9, y0 + H - 200, 4, 200); ctx.fillRect(x0 + 5, y0 + H - 200, 4, 200);
      }
    }
  }
  // 樓板（含一樓地基）；梯子的洞
  for (let f = 0; f <= S.F; f++) {
    if (f === S.F && roofTop) continue;
    const y = FY(f); if (y > v.y1 || y + T < v.y0) continue;
    ctx.fillStyle = slabPat; ctx.fillRect(-34, y, S.Wt + 68, T);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-34, y, S.Wt + 68, 3);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-34, y + T - 6, S.Wt + 68, 6);
  }
  for (const l of S.ladders) {
    const yb = FY(l.f), yt = FY(l.f + 1);
    if (yb < v.y0 || yt - 40 > v.y1 || l.x < v.x0 || l.x > v.x1) continue;
    ctx.fillStyle = '#16120e'; ctx.fillRect(l.x - 34, yt, 68, T);   // 樓板挖洞
    ladder(l.x, yb, yt - 34);
  }
}
let yardPat = null;
function drawYard(v, t) {
  if (!yardPat) yardPat = pattern(128, 40, (g, w, h) => {
    g.fillStyle = '#223a26'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = Math.random() < 0.5 ? 'rgba(10,25,12,.6)' : 'rgba(90,130,70,.35)'; g.lineWidth = 2; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y - 6); g.stroke(); }
  });
  const y0 = T;
  ctx.fillStyle = yardPat; ctx.fillRect(v.x0, y0, v.x1 - v.x0, 90);
  ctx.fillStyle = '#6b3a2a'; ctx.fillRect(v.x0, y0 + 90, v.x1 - v.x0, 70);   // 跑道
  ctx.fillStyle = 'rgba(240,230,210,.55)'; ctx.fillRect(v.x0, y0 + 122, v.x1 - v.x0, 3);
  ctx.fillStyle = '#1a2a1d'; ctx.fillRect(v.x0, y0 + 160, v.x1 - v.x0, Math.max(0, v.y1 - y0 - 160));
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 40); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(v.x0, y0, v.x1 - v.x0, 40);
  // 草地上的南瓜燈
  for (let x = Math.floor(v.x0 / 260) * 260 + 90; x < v.x1; x += 260) {
    const fl = 0.75 + 0.25 * Math.sin(t * 7 + x);
    ctx.globalCompositeOperation = 'lighter'; glowDisk(x, y0 + 52, 46, `rgba(255,150,40,${0.35 * fl})`); ctx.globalCompositeOperation = 'source-over';
    icon('items', 0, x, y0 + 56, 34);
  }
}
function ladder(x, yb, yt) {
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 24, yt, 52, yb - yt);
  ctx.fillStyle = '#8a6a43';
  for (let y = yb - 22; y > yt + 4; y -= 30) ctx.fillRect(x - 22, y, 44, 6);
  ctx.fillStyle = '#6e5233'; ctx.fillRect(x - 26, yt, 7, yb - yt); ctx.fillRect(x + 19, yt, 7, yb - yt);
  ctx.fillStyle = 'rgba(255,230,190,.25)'; ctx.fillRect(x - 26, yt, 2, yb - yt); ctx.fillRect(x + 19, yt, 2, yb - yt);
}

// 圖示：i 100 以上是第二張技能表 skills2
function icon(sheet, i, x, y, size, rot = 0) {
  if (i >= 100) { sheet = 'skills2'; i -= 100; }
  const im = IMG[sheet]; if (!im) return;
  const sx = (i % 4) * 128, sy = (i >> 2) * 128;
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(im, sx, sy, 128, 128, -size / 2, -size / 2, size, size); ctx.restore(); }
  else ctx.drawImage(im, sx, sy, 128, 128, x - size / 2, y - size / 2, size, size);
}
export function drawIcon(g, sheet, i, x, y, size) {
  if (i >= 100) { sheet = 'skills2'; i -= 100; }
  const im = IMG[sheet]; if (!im) return;
  g.drawImage(im, (i % 4) * 128, (i >> 2) * 128, 128, 128, x - size / 2, y - size / 2, size, size);
}

function glowDisk(x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawProps(S, t, o) {
  // 任務物品：發光、上下飄；翻找時有進度圈
  for (const it of S.items) {
    if (it.got) continue;
    const y = it.y - 60 + Math.sin(t * 2.4 + it.x) * 6;
    ctx.globalCompositeOperation = 'lighter'; glowDisk(it.x, y, 70, 'rgba(255,200,90,.45)'); ctx.globalCompositeOperation = 'source-over';
    icon('items', D.ITEMS[it.k].icon, it.x, y, 74);
    if (it.prog > 0) {
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(it.x, y, 50, 0, 6.29); ctx.stroke();
      ctx.strokeStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(it.x, y, 50, -1.57, -1.57 + 6.283 * Math.min(1, it.prog / D.PLAYER.search)); ctx.stroke();
    }
  }
  for (const c of S.chests) {
    if (c.open) continue;
    const y = c.y - 36;
    ctx.globalCompositeOperation = 'lighter'; glowDisk(c.x, y, 60 + Math.sin(t * 4) * 6, 'rgba(255,150,40,.4)'); ctx.globalCompositeOperation = 'source-over';
    icon('items', D.CHEST_ICON, c.x, y, 72);
  }
  // 撤離點：老師站在那裡；開了之後地上一圈光
  const ex = S.exit;
  if (ex.open) {
    ctx.globalCompositeOperation = 'lighter';
    const x0 = Math.floor(ex.x / W) * W;
    const g = ctx.createLinearGradient(0, ex.y - 220, 0, ex.y);
    g.addColorStop(0, 'rgba(120,255,200,0)'); g.addColorStop(1, `rgba(120,255,200,${0.22 + 0.08 * Math.sin(t * 4)})`);
    ctx.fillStyle = g; ctx.fillRect(x0 + 10, ex.y - 220, W - 20, 220);
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const n of o.npcs || []) HERO.draw(ctx, n.k, n.x, n.y, n.h);
  // 梯子提示：走近梯子時，上面畫往上的箭頭、樓板洞畫往下的箭頭
  const p = S.p;
  if (p.lad == null && !o.story) for (const l of S.ladders) {
    const d = Math.abs(l.x - p.x); if (d > 220) continue;
    const a = (1 - d / 220) * (0.6 + 0.3 * Math.sin(t * 6));
    if (l.f === p.f) chalkArrow(l.x, FY(l.f) - 230 - Math.abs(Math.sin(t * 4)) * 10, -1, a);
    else if (l.f + 1 === p.f) chalkArrow(l.x, FY(p.f) - 60 + Math.abs(Math.sin(t * 4)) * 10, 1, a);
  }
}
function chalkArrow(x, y, dir, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, dir);
  ctx.globalAlpha = a; ctx.strokeStyle = '#f4f0e3'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(0, -22); ctx.moveTo(-18, -4); ctx.lineTo(0, -24); ctx.lineTo(18, -4); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}

function drawPools(S, t) {
  for (const p of S.pools) {
    const a = Math.min(1, (p.dur - p.t) * 2, p.t * 6);
    ctx.globalAlpha = 0.75 * a;
    ctx.fillStyle = 'rgba(120,190,235,.75)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 4, p.r, p.r * 0.2, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = 'rgba(235,250,255,.8)';
    for (let i = 0; i < 3; i++) { const bx = p.x + Math.sin(i * 2.3 + p.x) * p.r * 0.55, sh = 0.5 + 0.5 * Math.sin(t * 3 + i * 2); ctx.globalAlpha = 0.75 * a * sh; ctx.beginPath(); ctx.ellipse(bx, p.y - 6, 14, 3, 0, 0, 6.29); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}
function drawGems(S, t) {
  for (const g of S.gems) {
    if (g.heart) icon('skills', 15, g.x, g.y, 30);
    else icon('skills', 14, g.x, g.y, g.big ? 30 : 22, Math.sin(t * 3 + g.x) * 0.3);
  }
}
function drawMon(S, m, t, v) {
  if (m.x < v.x0 || m.x > v.x1 || m.y < v.y0 || m.y > v.y1) return;
  const im = IMG[m.d.img];
  const sz = m.r * (m.k === 'bat' ? 3.2 : 2.7);
  const spd = m.stun > 0 ? 0 : 1;
  ctx.save();
  ctx.translate(m.x, m.y);
  if (!m.d.fly && !m.cl && m.y > FY(m.f) - m.r - 4) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, m.r - 2, m.r * 0.9, 6, 0, 0, 6.29); ctx.fill(); }
  let rot = 0, sy = 1, bob = 0;
  if (m.cl) rot = -1.35 * m.face + Math.sin(t * 14 + m.ph) * 0.2;
  else if (m.d.fly) { bob = Math.sin(t * (m.k === 'bat' ? 14 : 3) + m.ph) * (m.k === 'bat' ? 4 : 7); sy = m.k === 'bat' ? 1 + Math.sin(t * 22 + m.ph) * 0.15 : 1; }
  else { rot = Math.sin(t * 9 * spd + m.ph) * 0.14 * spd; sy = 1 + Math.abs(Math.sin(t * 9 * spd + m.ph)) * 0.06; bob = -Math.abs(Math.sin(t * 9 * spd + m.ph)) * 5 * spd; }
  if (m.d.boss) { rot *= 0.4; sy = 1 + Math.sin(t * 3) * 0.03; }
  ctx.translate(0, bob); ctx.rotate(rot); ctx.scale(m.face, sy);
  if (im) {
    const w = sz, h = sz * im.height / im.width;
    ctx.drawImage(im, -w / 2, -h / 2 - (m.d.fly ? 0 : h * 0.08), w, h);
    let tintC = null, ta = 0;
    if (m.flash > 0) { tintC = 'w'; ta = 0.85; }
    else if (m.burn > 0) { tintC = 'o'; ta = 0.5; m.burn -= 1 / 60; }
    else if (m.cold > 0 || m.stun > 0) { tintC = 'b'; ta = m.stun > 0 ? 0.35 : 0.3; }
    if (tintC) { ctx.globalAlpha = ta; ctx.drawImage(IMG[m.d.img + tintC], -w / 2, -h / 2 - (m.d.fly ? 0 : h * 0.08), w, h); ctx.globalAlpha = 1; }
  } else { ctx.fillStyle = '#f08a24'; ctx.beginPath(); ctx.arc(0, 0, m.r, 0, 6.29); ctx.fill(); }
  ctx.restore();
  // 耐打的怪頭上有血條
  if ((m.k === 'mummy' || m.k === 'ghost') && m.hp < m.max) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(m.x - 24, m.y - m.r - 18, 48, 6);
    ctx.fillStyle = '#e8443a'; ctx.fillRect(m.x - 23, m.y - m.r - 17, 46 * Math.max(0, m.hp / m.max), 4);
  }
}

function drawPlayer(S, t, o) {
  const p = S.p;
  if (o.heroHidden) return;
  // 披風護盾：一圈紫光
  if (p.shield > 0) {
    ctx.strokeStyle = `rgba(255,120,90,${0.45 + 0.15 * Math.sin(t * 5)})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 56, 52, 66, 0, 0, 6.29); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, 30, 7, 0, 0, 6.29); ctx.fill();
  HERO.draw(ctx, 'bian', p.x, p.y + 2, D.PLAYER.h, { red: p.hurtT > 0 ? 0.38 : 0 });
  // 冰棒寒氣
  const fr = CORE.sv(S, 'frost');
  if (fr) {   // 電風扇：一圈一圈往外吹的風線
    ctx.strokeStyle = 'rgba(235,245,255,.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a0 = t * 2.4 + i * 0.9, r = fr.r * (0.45 + ((t * 0.8 + i * 0.37) % 1) * 0.55); ctx.beginPath(); ctx.arc(p.x, CORE.pc(S), r, a0, a0 + 0.5); ctx.stroke(); }
  }
  drawDiabolo(S, t);
}
// 扯鈴：小編兩手各拿一根棍子，中間一條線吊著扯鈴；拋出去時線拉長，落地狂轉
function drawDiabolo(S, t) {
  const d = S.dia; if (!d) return;
  const p = S.p, cy = CORE.pc(S), f = p.face;
  const lx = p.x - 26, rx = p.x + 26, sy = cy - 10;
  ctx.lineCap = 'round';
  // 兩根棍子（從手往上斜）
  for (const [x, dx] of [[lx, -1], [rx, 1]]) { ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + dx * 14, sy - 34); ctx.stroke(); ctx.strokeStyle = '#c98a4a'; ctx.lineWidth = 3; ctx.stroke(); }
  const tl = [lx - 14, sy - 34], tr = [rx + 14, sy - 34];
  // 線：手上時是 V 字吊著；拋出去時兩條線拉到扯鈴（飛遠了就只剩一條細線）
  const far = d.st !== 'hold';
  ctx.strokeStyle = far ? 'rgba(240,235,220,.55)' : '#f0ebdc'; ctx.lineWidth = far ? 1.5 : 2;
  const dy = d.st === 'hold' ? d.y + 14 : d.y;
  ctx.beginPath(); ctx.moveTo(tl[0], tl[1]); ctx.lineTo(d.x, dy); ctx.lineTo(tr[0], tr[1]); ctx.stroke();
  // 扯鈴本體：兩個紅色碗口相對、中間黃色軸；轉的時候碗口的條紋左右跑
  const sz = d.st === 'spin' ? 1.35 : 1, x = d.x, y = d.y;
  ctx.save(); ctx.translate(x, y); ctx.scale(sz, sz);
  if (d.st === 'spin') {   // 狂轉：地上一圈旋風
    ctx.strokeStyle = 'rgba(255,230,180,.45)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const a0 = d.spin * 0.3 + i * 2.1; ctx.beginPath(); ctx.ellipse(0, 18, 60 + i * 18, 14 + i * 4, 0, a0, a0 + 2.2); ctx.stroke(); }
  }
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#c8322b'; ctx.strokeStyle = '#3a1410'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(s * 3, -4); ctx.lineTo(s * 20, -15); ctx.lineTo(s * 20, 15); ctx.lineTo(s * 3, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd34d'; const k = Math.sin(d.spin + s) * 10; ctx.fillRect(s * 20 - 2, k - 2, 4, 4);   // 碗口上的亮點在轉
    ctx.fillStyle = '#7a1d18'; ctx.beginPath(); ctx.ellipse(s * 20, 0, 3, 15, 0, 0, 6.29); ctx.fill();
  }
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
  if (d.st !== 'hold') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(x, y, 28 + i * 6, d.spin * 0.5 + i, d.spin * 0.5 + i + 1); ctx.stroke(); } }
}
// 籃球、直笛音波、圖釘、粉筆灰、呼拉圈
function drawExtras(S, t) {
  const p = S.p, cx = p.x, cy = CORE.pc(S);
  for (const tk of S.tacks) { const a = Math.min(1, (tk.dur - tk.t) * 2); ctx.globalAlpha = a; icon('skills2', 2, tk.x, tk.y - 8, 26, tk.rot); ctx.globalAlpha = 1; }
  for (const cl of S.clouds) {
    const a = Math.min(1, (cl.dur - cl.t) * 1.5, cl.t * 6);
    for (let i = 0; i < 7; i++) { const an = i * 0.9 + cl.t * 0.6, rr = cl.r * (0.35 + 0.25 * Math.sin(i * 2.1 + cl.t)); ctx.fillStyle = `rgba(245,242,232,${0.22 * a})`; ctx.beginPath(); ctx.arc(cl.x + Math.cos(an) * cl.r * 0.45, cl.y + Math.sin(an) * cl.r * 0.3, rr, 0, 6.29); ctx.fill(); }
  }
  for (const rg of S.rings) {
    const a = 1 - rg.t / rg.dur, cols = ['#e8443a', '#f2d46b', '#3fa0e0', '#7ee04a'];
    ctx.lineWidth = 9; ctx.globalAlpha = 0.4 + 0.6 * a;
    for (let i = 0; i < 8; i++) { ctx.strokeStyle = cols[i % 4]; ctx.beginPath(); ctx.ellipse(cx, cy, rg.r, rg.r * 0.55, 0, i * 0.785 + rg.t * 4, (i + 1) * 0.785 + rg.t * 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  for (const w of S.waves) {
    const k = w.t / w.dur, a = 1 - k;
    ctx.strokeStyle = `rgba(255,236,170,${a * 0.8})`; ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) { const r = (k * w.len) - i * 50; if (r < 20) continue; ctx.beginPath(); ctx.ellipse(w.x, w.y, r, 60 + r * 0.15, 0, w.dir > 0 ? -0.6 : Math.PI - 0.6, w.dir > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke(); }
    ctx.fillStyle = `rgba(255,236,170,${a})`; ctx.font = '700 30px serif'; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) ctx.fillText(i % 2 ? '♫' : '♪', w.x + w.dir * (k * w.len * (0.4 + i * 0.25)), w.y - 30 + Math.sin(t * 8 + i) * 14 - i * 10);
  }
  for (const b of S.balls) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 30, 14, 4, 0, 0, 6.29); ctx.fill(); icon('skills2', 0, b.x, b.y, 40, b.rot); }
}
// 校長（休息時跟在旁邊）／針筒超人（飛來飛去撞怪）
function drawHelper(S, t, o) {
  const h = S.helper; if (!h || o.story) return;
  const flying = h.ph === 'fight';
  const k = flying ? 'needle' : 'zhang';
  if (!flying) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(h.x, h.y - 2, 28, 6, 0, 0, 6.29); ctx.fill(); }
  const white = h.ph === 'tf' ? Math.min(1, h.t * 2) : h.ph === 'back' ? 1 - h.t / 0.6 : 0;
  HERO.draw(ctx, k, h.x, h.y + (flying ? Math.sin(t * 4) * 6 : 2), 120, { white: white > 0 ? white * 0.9 : 0 });
  ctx.font = '700 22px "LXGW WenKai TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (h.ph === 'calm') {
    // 頭上的變身倒數（圈圈）
    const y = h.y - 150, f = 1 - h.left / (h.left > 3 ? 20 : 2);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(h.x, y, 16, 0, 6.29); ctx.stroke();
    ctx.strokeStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(h.x, y, 16, -1.57, -1.57 + 6.283 * Math.max(0, Math.min(1, f))); ctx.stroke();
    // 剛變回來喊痛；之後偶爾問一句（每 7 秒抽一次、六成會講）
    const L = D.HERO_LINES;
    if (h.ouch && h.t < 2.2) bubble(h.x, h.y - 190, L.back);
    else if (!h.ouch && h.t < 2) bubble(h.x, h.y - 190, '校長來幫忙了！');
    else {
      const slot = Math.floor(h.t / 7), seed = Math.sin(slot * 12.9 + h.x * 0.001) * 43758.5, r = seed - Math.floor(seed);
      if (slot > 0 && r < 0.6 && h.t % 7 < 2.6) bubble(h.x, h.y - 190, L.calm[Math.floor(r / 0.6 * L.calm.length)]);
    }
  } else if (h.ph === 'back') {
    bubble(h.x, h.y - 190, D.HERO_LINES.back);
  } else if (h.ph === 'tf') {
    ctx.globalCompositeOperation = 'lighter'; glowDisk(h.x, h.y - 60, 150 * Math.min(1, h.t * 2), `rgba(255,240,200,${0.8 - h.t * 0.6})`); ctx.globalCompositeOperation = 'source-over';
    bubble(h.x, h.y - 190, D.HERO_LINES.tf);
  } else if (flying && h.left < 3) bubble(h.x, h.y - 170, '快沒電了…');
}
function bubble(x, y, s) {
  const w = ctx.measureText(s).width + 26;
  ctx.fillStyle = 'rgba(250,246,236,.95)'; ctx.strokeStyle = '#3a3530'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.rect(x - w / 2, y - 20, w, 40); ctx.moveTo(x - 8, y + 20); ctx.lineTo(x, y + 32); ctx.lineTo(x + 8, y + 20); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a3530'; ctx.fillText(s, x, y + 1);
}
function drawHpBar(S) {
  const p = S.p, x = p.x, y = p.y - D.PLAYER.h - 24;
  ctx.fillStyle = 'rgba(10,10,10,.7)'; ctx.fillRect(x - 38, y, 76, 10);
  ctx.fillStyle = p.hp / p.max < 0.3 ? '#ff4b3a' : '#7ee04a'; ctx.fillRect(x - 36, y + 2, 72 * p.hp / p.max, 6);
  for (let i = 0; i < p.shield; i++) { ctx.fillStyle = '#ff8a6a'; ctx.fillRect(x - 36 + i * 14, y - 8, 10, 5); }
}
function drawShots(S, t) {
  for (const s of S.shots) {
    if (s.k === 'candy') icon('skills', 0, s.x, s.y, 28, s.rot);
    else { ctx.fillStyle = 'rgba(210,255,230,.9)'; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, 6.29); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, 3, 0, 6.29); ctx.fill(); }
  }
  for (const b of S.bombs) {
    const k = Math.min(1, b.t / b.dur), x = b.x0 + (b.x - b.x0) * k, y = b.y0 + (b.y - b.y0) * k - Math.sin(k * Math.PI) * 160;
    icon(b.type === 'eraser' ? 'skills2' : 'skills', b.type === 'eraser' ? 3 : 2, x, y, 38, k * 8);
  }
}
// 跳繩：從身體甩出去的繩子（中間微彎），尾端有木把手
function drawGlow(S, t) {
  const v = CORE.sv(S, 'glow'); if (!v) return;
  const cx = S.p.x, cy = CORE.pc(S);
  ctx.lineCap = 'round';
  for (let i = 0; i < v.n; i++) {
    const a = S.p.glowA + i * Math.PI * 2 / v.n, ca = Math.cos(a), sa = Math.sin(a);
    const x0 = cx + ca * 30, y0 = cy + sa * 30, x1 = cx + ca * v.len, y1 = cy + sa * v.len;
    const bend = v.len * 0.18, mx = (x0 + x1) / 2 - sa * bend, my = (y0 + y1) / 2 + ca * bend;   // 往後拖一點（轉的反方向）
    // 殘影
    ctx.strokeStyle = 'rgba(255,240,210,.18)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx - ca * 10, my - sa * 10, x1, y1); ctx.stroke();
    for (const [w, c] of [[9, '#3a2614'], [5, '#efe3c6']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke(); }
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(a);
    ctx.fillStyle = '#3a2614'; ctx.fillRect(-4, -8, 30, 16); ctx.fillStyle = '#c98a4a'; ctx.fillRect(-2, -6, 26, 12);
    ctx.restore();
  }
}
// 竹掃把：一支掃把從身體揮出去，後面一片灰塵
function drawBeams(S) {
  const cx = S.p.x, cy = CORE.pc(S);
  for (const b of S.beams) {
    const a = Math.min(1, (b.dur - b.t) * 6, b.t * 10);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.a);
    const g = ctx.createLinearGradient(0, 0, b.len, 0);
    g.addColorStop(0, `rgba(230,210,170,${0.05 * a})`); g.addColorStop(0.6, `rgba(220,200,160,${0.4 * a})`); g.addColorStop(1, `rgba(220,200,160,0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(20, -6); ctx.lineTo(b.len, -b.w * 1.2); ctx.lineTo(b.len, b.w * 1.2); ctx.lineTo(20, 6); ctx.fill();
    ctx.globalAlpha = a;
    const L = Math.min(b.len * 0.55, 300);
    ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.strokeStyle = '#d9b36a'; ctx.lineWidth = 5; ctx.stroke();
    ctx.translate(L + 40, 0); ctx.rotate(Math.PI * 0.75); icon('skills', 4, 0, 0, 130);
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
// 紙飛機：從左上俯衝到怪身上，撞到噴紙屑
function drawBolts(S, t) {
  for (const b of S.bolts) {
    const k = b.t / b.dur;
    if (k < 0.55) {
      const q = k / 0.55, sx = b.x - 320 * (1 - q) * (Math.sin(b.seed) > 0 ? 1 : -1), sy = b.y - 520 * (1 - q);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(b.y - sy, b.x - sx) + 0.6); icon('skills', 6, 0, 0, 64); ctx.restore();
    } else {
      const a = 1 - (k - 0.55) / 0.45;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      for (let i = 0; i < 8; i++) { const an = i * 0.785 + b.seed, r = 20 + (1 - a) * 60; ctx.fillRect(b.x + Math.cos(an) * r - 4, b.y + Math.sin(an) * r - 3, 8, 6); }
    }
  }
}
function drawFx(S) {
  for (const f of S.fx) {
    const k = f.t / f.dur, a = 1 - k;
    if (f.k === 'flash') {
      ctx.strokeStyle = `rgba(255,255,230,${a * 0.8})`; ctx.lineWidth = 14 * a + 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, 6.29); ctx.stroke();
      glowDisk(f.x, f.y, f.r * 0.8, `rgba(255,255,220,${a * 0.5})`);
    } else if (f.k === 'boom') {   // 躲避球砸地：白色衝擊圈
      glowDisk(f.x, f.y, f.r * (0.6 + k * 0.5), `rgba(255,120,100,${a * 0.6})`);
      ctx.strokeStyle = `rgba(255,245,230,${a})`; ctx.lineWidth = 10 * a + 1; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.4 + k * 0.8), f.r * (0.25 + k * 0.45), 0, 0, 6.29); ctx.stroke();
    } else if (f.k === 'pop') {
      ctx.strokeStyle = `rgba(255,220,120,${a})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + k), 0, 6.29); ctx.stroke();
    }
  }
}
function drawParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.t >= p.dur) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const a = 1 - p.t / p.dur;
    if (p.c === 'puff') { ctx.fillStyle = `rgba(230,230,220,${a * 0.35})`; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.s * (0.5 + p.t / p.dur)), 0, 6.29); ctx.fill(); continue; }
    ctx.globalAlpha = a; ctx.fillStyle = p.c;
    if (p.star) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 6); ctx.fillRect(-p.s, -1.5, p.s * 2, 3); ctx.fillRect(-1.5, -p.s, 3, p.s * 2); ctx.restore(); }
    else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    ctx.globalAlpha = 1;
  }
}
function drawNums(dt) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.t += dt;
    const dur = n.hurt || n.heal ? 0.9 : 0.6;
    if (n.t >= dur) { nums.splice(i, 1); continue; }
    const k = n.t / dur, y = n.y - 50 * k - (n.hurt ? 10 : 0);
    const s = n.big ? 34 : n.hurt ? 34 : 24, pop = k < 0.15 ? 1 + (0.15 - k) * 3 : 1;
    ctx.font = `900 ${Math.round(s * pop)}px "Arial Black", "Helvetica Neue", sans-serif`;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.lineWidth = 6; ctx.strokeStyle = '#1a1208'; ctx.strokeText(n.n, n.x, y);
    ctx.fillStyle = n.hurt ? '#ff5a4a' : n.heal ? '#8ef06a' : n.big ? '#ffcf3a' : '#fff6e8';
    ctx.fillText(n.n, n.x, y);
    ctx.globalAlpha = 1;
  }
}

// 指路：畫面外就在邊上畫箭頭＋名字；畫面裡就在目標頭上跳
function target(S) {
  if (S.boss && !S.boss.dead) return { x: S.boss.x, y: S.boss.y - 40, label: S.boss.d.name, boss: true };
  if (!S.items.every((i) => i.got)) {
    const p = S.p, left = S.items.filter((i) => !i.got);
    left.sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.f - p.f) * 900) - (Math.abs(b.x - p.x) + Math.abs(b.f - p.f) * 900));
    const it = left[0]; return { x: it.x, y: it.y - 60, label: D.ITEMS[it.k].name, icon: D.ITEMS[it.k].icon };
  }
  if (S.exit.open) return { x: S.exit.x, y: S.exit.y - 140, label: '撤離點', exit: true };
  return null;
}
function drawPointer(S, t) {
  const tg = target(S); if (!tg) return;
  const s = toScreen(S, tg.x, tg.y);
  const m = 46, top = 120, bot = 90;
  const inside = s.x > m && s.x < cssW - m && s.y > top && s.y < cssH - bot;
  ctx.font = `700 15px "LXGW WenKai TC", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const col = tg.exit ? '#7dffc8' : tg.boss ? '#ff7a4a' : '#ffd34d';
  if (inside) {
    if (tg.exit && S.exit.inRoom) return;
    const y = s.y - 56 - Math.abs(Math.sin(t * 4)) * 10;
    arrowHead(s.x, y, Math.PI / 2, col);
    if (tg.exit) label(s.x, y - 30, tg.label, col);
    return;
  }
  const cx = cssW / 2, cy = cssH / 2, dx = s.x - cx, dy = s.y - cy;
  const kx = dx ? ((dx > 0 ? cssW - m : m) - cx) / dx : Infinity, ky = dy ? ((dy > 0 ? cssH - bot : top) - cy) / dy : Infinity;
  const k = Math.min(kx, ky), ax = cx + dx * k, ay = cy + dy * k, a = Math.atan2(dy, dx);
  const pulse = 1 + Math.sin(t * 5) * 0.08;
  ctx.save(); ctx.translate(ax, ay); ctx.scale(pulse, pulse); arrowHead(0, 0, a, col); ctx.restore();
  const lx = ax - Math.cos(a) * 46, ly = ay - Math.sin(a) * 40;
  if (tg.icon != null) drawIcon(ctx, 'items', tg.icon, lx, ly - 10, 34);
  label(lx, ly + (tg.icon != null ? 18 : 0), tg.label, col);
}
function arrowHead(x, y, a, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = col; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, -14); ctx.lineTo(-5, 0); ctx.lineTo(-12, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function label(x, y, s, col) {
  ctx.lineWidth = 4; ctx.strokeStyle = '#1a1208'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function drawJoy(j) {
  ctx.strokeStyle = 'rgba(255,240,220,.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(j.bx, j.by, 54, 0, 6.29); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,220,.28)'; ctx.beginPath(); ctx.arc(j.x, j.y, 26, 0, 6.29); ctx.fill();
}
function drawBossBar(S, o) {
  const b = S.boss, w = Math.min(cssW - 60, 420), x = (cssW - w) / 2, y = (o.hudBottom || 120) + 26;   // 放在上方資訊下面（下面是提示）
  ctx.fillStyle = 'rgba(10,8,6,.75)'; ctx.fillRect(x - 3, y - 3, w + 6, 18);
  ctx.fillStyle = '#ff7a2a'; ctx.fillRect(x, y, w * Math.max(0, b.hp / b.max), 12);
  ctx.font = '700 15px "LXGW WenKai TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  label(cssW / 2, y - 6, b.d.name, '#ffd34d');
}
