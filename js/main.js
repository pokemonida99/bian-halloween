// 主程式：畫面切換、搖桿、遊戲迴圈、上方資訊、升級卡、劇情對話、存檔
import * as HERO from './hero.js?v=1';
import * as R from './render.js?v=1';

const CORE = window.CORE, D = window.DATA, SND = window.SND;
const $ = (id) => document.getElementById(id);
const ui = $('ui'), cv = $('cv');
let S = null, mode = 'loading', li = 0, last = performance.now(), acc = 0, T = 0;
let talkQ = [], talkI = 0, talkDone = null, typeT = 0, cardsAt = 0, tipT = 0, story = false;
let view = { w: 720, h: 1280 }, uiScale = 1;
const joy = { id: null, bx: 0, by: 0, x: 0, y: 0, on: false };
const keys = new Set();
const BOT_ON = /[?&]bot/.test(location.search);   // 測試：自動玩、自動選卡
if (BOT_ON) { const sc = document.createElement('script'); sc.src = 'js/bot.js'; document.head.appendChild(sc); }

// ---------- 存檔 ----------
const SAVE_KEY = 'bian-halloween';
let save = { open: 1, best: {} };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.open) save = s; } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ---------- 擋縮放、選取、長按 ----------
const stop = (e) => e.preventDefault();
['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu', 'selectstart', 'dragstart'].forEach((ev) => document.addEventListener(ev, stop, { passive: false }));
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !e.target.closest('#select')) e.preventDefault(); }, { passive: false });
let lastTouch = 0;
document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouch < 320) e.preventDefault(); lastTouch = now; }, { passive: false });
window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });

// ---------- 版面 ----------
const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);pointer-events:none'; document.body.appendChild(probe);
function layout() {
  view = R.resize();
  const w = innerWidth, h = innerHeight;
  uiScale = Math.min(w / 720, h / 1100);
  if (h / w >= 1.45) uiScale = w / 720;
  ui.style.transform = `translateX(${(w - 720 * uiScale) / 2}px) scale(${uiScale})`;
  const vh = h / uiScale;
  ui.style.height = vh + 'px';
  document.documentElement.style.setProperty('--vh', vh + 'px');
  document.documentElement.style.setProperty('--sat', (probe.offsetHeight / uiScale) + 'px');
  if (S) { S.view.w = view.w; S.view.h = view.h; }
}
addEventListener('resize', layout);

// ---------- 輸入：按住畫面任何地方就是搖桿 ----------
cv.addEventListener('pointerdown', (e) => {
  if (mode === 'talk') { nextTalk(); return; }
  if (mode !== 'play' || joy.id != null) return;
  joy.id = e.pointerId; joy.bx = joy.x = e.clientX; joy.by = joy.y = e.clientY; joy.on = true;
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joy.id) return;
  const R0 = 54; let dx = e.clientX - joy.bx, dy = e.clientY - joy.by; const d = Math.hypot(dx, dy);
  if (d > R0 * 1.6) { joy.bx += dx / d * (d - R0 * 1.6); joy.by += dy / d * (d - R0 * 1.6); dx = e.clientX - joy.bx; dy = e.clientY - joy.by; }   // 手指拖太遠，底座跟著走
  joy.x = e.clientX; joy.y = e.clientY;
});
const endJoy = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.on = false; } };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (mode === 'talk' && (e.key === ' ' || e.key === 'Enter')) nextTalk();
  if (mode === 'pick' && ['1', '2', '3'].includes(e.key)) { const b = $('cardRow').children[+e.key - 1]; if (b) b.click(); }
  if (e.key === 'Escape' && mode === 'play') pause(true);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function readInput() {
  if (window.BOT && BOT_ON) return window.BOT(S);
  let x = 0, y = 0;
  if (joy.on) {
    const dx = joy.x - joy.bx, dy = joy.y - joy.by, d = Math.hypot(dx, dy), m = Math.min(1, d / 54);
    if (d > 6) { x = dx / d * m; y = dy / d * m; }
  }
  if (keys.has('a') || keys.has('arrowleft')) x = -1;
  if (keys.has('d') || keys.has('arrowright')) x = 1;
  if (keys.has('w') || keys.has('arrowup')) y = -1;
  if (keys.has('s') || keys.has('arrowdown')) y = 1;
  return { x, y };
}

// ---------- 畫面切換 ----------
const SCREENS = ['loading', 'title', 'select', 'hud', 'cards', 'talk', 'pause', 'result', 'wait', 'tip'];
function show(...ids) { for (const s of SCREENS) $(s).classList.toggle('hide', !ids.includes(s)); }

function goTitle() {
  mode = 'title'; story = true;
  S = CORE.create(0, { seed: 7, vw: view.w, vh: view.h });
  S.p.x = 1.5 * D.ROOM.W; CORE.updCam(S, 1);
  show('title'); SND.music('title');
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone;
  $('iosTip').classList.toggle('hide', !ios);
}
function goSelect() {
  mode = 'select'; show('select');
  const box = $('levels'); box.innerHTML = '';
  D.LEVELS.forEach((L, i) => {
    const b = document.createElement('button'); b.className = 'lvc' + (i + 1 > save.open ? ' lock' : '');
    b.style.setProperty('--r', ((i % 2 ? 1 : -1) * 0.6) + 'deg');
    const its = L.items.map(([k]) => `<i style="${iconPos(D.ITEMS[k].icon)}"></i>`).join('');
    const best = save.best[i] != null ? `<span class="best">最快 ${fmt(save.best[i])}</span>` : '';
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t"><b>${L.name}</b><span>${L.sub}</span></span><span class="its">${its}</span>${best}`;
    b.onclick = () => { if (i + 1 > save.open) return; SND.play('tap'); startLevel(i); };
    box.appendChild(b);
  });
}
const iconPos = (i) => `background-position:${(i % 4) * 33.333}% ${(i >> 2) * 33.333}%`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function fullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen && !/iPhone|iPad|iPod/.test(navigator.userAgent)) el.requestFullscreen().catch(() => {});
}

// ---------- 開始一關 ----------
function startLevel(i) {
  li = i; fullscreen();
  S = CORE.create(i, { vw: view.w, vh: view.h });
  acc = 0; joy.id = null; joy.on = false;
  // 槽位
  $('slots').innerHTML = S.items.map((it) => `<div class="slot"><i style="${iconPos(D.ITEMS[it.k].icon)}"></i></div>`).join('');
  SND.urgent(false);
  const st = D.STORY[S.L.story];
  story = true;
  talk(st.intro, () => { story = false; begin(); });
}
function begin() {
  mode = 'play'; show('hud'); SND.music('play');
  if (li === 0) tip('手指按住畫面拖曳就能走；走到梯子往上推就會爬', 6);
  else tip(`找到 ${S.items.map((it) => D.ITEMS[it.k].name).join('、')}`, 4);
}

// 劇情：人物站在畫面裡，下面一格對話
function npcs() {
  if (!S) return [];
  const L = S.L, list = L.npc === 'both' ? ['tu', 'zhang'] : [L.npc];
  const p = S.p, out = [];
  if (story) {
    const side = p.x > S.Wt - 260 ? -1 : 1;
    list.forEach((k, i) => out.push({ k, x: p.x + side * (110 + i * 95), y: p.y, h: k === 'zhang' ? 118 : 112, face: -side }));
  } else {
    const ex = S.exit;
    list.forEach((k, i) => out.push({ k, x: ex.x + 80 + i * 90, y: ex.y, h: k === 'zhang' ? 118 : 112, face: -1 }));
  }
  return out;
}
function talk(lines, done) {
  talkQ = lines; talkI = -1; talkDone = done; mode = 'talk';
  show('talk');
  nextTalk();
  if (BOT_ON) setTimeout(() => { if (mode !== 'talk') return; typeT = 999; talkI = talkQ.length - 1; nextTalk(); }, 500);
}
function nextTalk() {
  const p = $('talkText');
  if (mode !== 'talk' || talkI >= talkQ.length) return;   // 對話已經結束（連點多按的）
  if (talkI >= 0 && typeT < talkQ[talkI][1].length) { typeT = 999; return; }   // 字還在跑：先整句顯示
  talkI++;
  if (talkI >= talkQ.length) { const d = talkDone; talkDone = null; d && d(); return; }
  const [who] = talkQ[talkI];
  const w = $('talkWho'); w.textContent = D.NAMES[who]; w.className = 'who ' + who;
  typeT = 0; p.textContent = '';
  if (who !== 'bian') HERO.act(who, who === 'tu' ? 'hop' : 'handsup');
  SND.play('tap');
}
$('talkSkip').addEventListener('click', (e) => { e.stopPropagation(); if (mode !== 'talk') return; typeT = 999; talkI = talkQ.length - 1; nextTalk(); });
$('talk').addEventListener('pointerdown', (e) => { if (e.target.id !== 'talkSkip') nextTalk(); });

// ---------- 升級卡 ----------
function showCards() {
  mode = 'pick'; joy.id = null; joy.on = false; cardsAt = performance.now();
  show('hud', 'cards');
  const opening = S.t === 0;
  $('cardsTitle').textContent = opening ? '出發前，挑一樣帶著' : S.lastChest ? '南瓜寶箱！挑一個' : `升到 Lv ${S.p.lv - S.pending}！選一個`;
  S.lastChest = false;
  const row = $('cardRow'); row.innerHTML = '';
  if (BOT_ON) setTimeout(() => { cardsAt = 0; const b = $('cardRow').children[0]; b && b.click(); }, 400);
  S.offer.forEach((k, i) => {
    const b = document.createElement('button'); b.className = 'card';
    b.style.setProperty('--r', ((i - 1) * 1.2) + 'deg');
    if (k === 'heal') {
      b.innerHTML = `<span class="ic" style="${iconPos(15)}"></span><b>補血</b><p>技能都滿級了，把血補滿</p>`;
    } else {
      const sk = D.SKILLS[k], lv = S.sk[k] || 0;
      const pips = Array.from({ length: D.MAXLV }, (_, j) => `<i class="${j < lv ? 'on' : j === lv ? 'nx' : ''}"></i>`).join('');
      b.innerHTML = `${lv ? '' : '<span class="new">新</span>'}<span class="ic" style="${iconPos(sk.icon)}"></span><b>${sk.name}</b><span class="lvl">${pips}</span><p>${sk.desc[lv]}</p>`;
    }
    b.onclick = () => {
      if (performance.now() - cardsAt < 350) return;   // 剛跳出來，避免手指還在拖搖桿誤點
      CORE.choose(S, k); SND.play('pick');
      if (S.pending > 0 || S.chestPick > 0) { CORE.step(S, 0); if (S.state === 'pick') { showCards(); return; } }
      mode = 'play'; show('hud');
    };
    row.appendChild(b);
  });
}

// ---------- 暫停、結算 ----------
function pause(on) {
  if (on) {
    mode = 'pause'; joy.id = null; joy.on = false; show('hud', 'pause');
    $('haveList').innerHTML = Object.entries(S.sk).map(([k, v]) => `<span style="${iconPos(D.SKILLS[k].icon)}"><b>${v}</b></span>`).join('');
    $('pMute').textContent = '聲音：' + (SND.muted() ? '關' : '開');
  } else { mode = 'play'; show('hud'); }
}
$('bPause').addEventListener('click', () => { if (mode === 'play') pause(true); });
$('pResume').onclick = () => pause(false);
$('pRetry').onclick = () => startLevel(li);
$('pMenu').onclick = () => goSelect();
$('pMute').onclick = () => { SND.setMuted(!SND.muted()); $('pMute').textContent = '聲音：' + (SND.muted() ? '關' : '開'); };

function cleared() {
  mode = 'outro'; story = true; joy.on = false;
  SND.urgent(false); SND.music(null);
  HERO.act('bian', 'sig_bian', true);
  const t = S.t;
  if (save.best[li] == null || t < save.best[li]) save.best[li] = t;
  save.open = Math.max(save.open, Math.min(D.LEVELS.length, li + 2));
  persist();
  setTimeout(() => {
    HERO.stopAct('bian');
    talk(D.STORY[S.L.story].outro, () => result(true));
  }, 1600);
}
function failed() {
  mode = 'dead'; joy.on = false; SND.urgent(false); SND.music(null);
  HERO.act('bian', 'stumble');
  setTimeout(() => result(false), 1400);
}
function result(win) {
  mode = 'result'; story = false;
  show('result');
  const r = $('result'); r.classList.toggle('lose', !win);
  const d = new Date(); $('rDate').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日　第 ${li + 1} 關`;
  const got = S.items.filter((i) => i.got).length;
  $('rTitle').textContent = win ? '過關！' : '挑戰失敗';
  $('rStats').innerHTML = `<li>撐了 <b>${fmt(S.t)}</b></li><li>擊倒 <b>${S.kills}</b> 隻</li><li>拿到 <b>${got}/3</b> 樣東西・Lv <b>${S.p.lv}</b></li>`;
  const last = li === D.LEVELS.length - 1;
  $('rLine').textContent = win ? (last ? '萬聖節晚會開始囉！全部路線都走完了。' : '老師評語：小編今天很努力，可以下班了（還不行）。') : got < 3 ? '再來一次！先挑能打一整圈的武器會比較好過。' : '東西都拿到了，差一點！撤離時記得一直走位。';
  $('rNext').textContent = win ? (last ? '再玩一次' : '下一關') : '再來一次';
  $('rNext').onclick = () => { SND.play('tap'); startLevel(win ? (last ? 0 : li + 1) : li); };
  $('rMenu').onclick = () => { SND.play('tap'); goSelect(); };
  SND.play(win ? 'clear' : 'dead');
}

// ---------- 遊戲事件 ----------
function tip(text, sec = 2.6, warn = false) {
  const t = $('tip'); $('tipText').textContent = text; t.classList.remove('hide', 'show'); t.classList.toggle('warn', warn);
  void t.offsetWidth; t.classList.add('show'); tipT = sec;
}
function handleEvents() {
  const ev = S.ev; if (!ev.length) return;
  R.events(S, ev);
  for (const e of ev) {
    switch (e.k) {
      case 'throw': SND.play('throw'); break;
      case 'dmg': SND.play('hit'); break;
      case 'die': SND.play('die'); break;
      case 'boom': SND.play('boom'); break;
      case 'thunder': SND.play('thunder'); break;
      case 'flash': SND.play('flash'); break;
      case 'beam': SND.play('beam'); break;
      case 'gem': SND.play('gem'); break;
      case 'lvup': SND.play('lvup'); break;
      case 'hurt': SND.play('hurt'); break;
      case 'block': SND.play('block'); break;
      case 'search': SND.play('search'); tip('翻找中…站著別走開', 1.6); break;
      case 'item': {
        SND.play('item');
        const n = S.items.filter((i) => i.got).length, idx = S.items.indexOf(e.it);
        const s = $('slots').children[idx]; if (s) { s.classList.add('got', 'pop'); }
        if (n < 3) tip(`拿到${D.ITEMS[e.it.k].name}了！（${n}/3）`);
        break;
      }
      case 'chest': SND.play('chest'); S.lastChest = true; break;
      case 'horde': if (e.label !== 'last' && e.label !== 'boss') { SND.play('horde'); tip(`一大群南瓜仔從${e.side === 'left' ? '左' : '右'}邊來了！`, 2.4, true); } break;
      case 'exit': {
        SND.play('exit'); SND.urgent(true);
        if (!S.L.boss) { const ex = S.exit, room = D.ROOM, name = roomName(S.rooms[ex.f][Math.floor(ex.x / room.W)]); tip(`三樣都拿齊了！回 ${ex.f + 1} 樓${name}找${D.NAMES[S.L.npc] || '老師'}`, 3.6, true); }
        else tip('南瓜大王倒了！到頂樓的撤離點', 3.2, true);
        break;
      }
      case 'boss': SND.play('boss'); SND.urgent(true); tip('頂樓的南瓜大王出現了！', 3.2, true); break;
      case 'bossDown': SND.play('boom'); break;
      case 'waitStart': tip(`站在房間裡等${S.L.npc === 'zhang' ? '校長' : '兔兔老師'}開門，撐住！`, 2.6, true); break;
      case 'clear': SND.play('clear'); cleared(); break;
      case 'dead': failed(); break;
    }
  }
  ev.length = 0;
}
const ROOMN = { class: '教室', lab: '自然教室', library: '圖書室', nurse: '保健室', music: '音樂教室', gym: '禮堂', office: '校長室', hall: '走廊', roof: '頂樓' };
const roomName = (k) => ROOMN[k] || '';

// ---------- 上方資訊 ----------
let lastHud = '';
function hud() {
  const p = S.p;
  $('xpBar').style.width = Math.min(100, p.xp / p.need * 100).toFixed(1) + '%';
  const key = `${p.lv}|${Math.floor(S.t)}|${S.kills}`;
  if (key !== lastHud) { lastHud = key; $('lvN').textContent = 'Lv ' + p.lv; $('clock').textContent = fmt(S.t); $('kills').textContent = '擊倒 ' + S.kills; }
  const ex = S.exit, w = $('wait');
  const showWait = mode === 'play' && ex.open && ex.wait > 0;
  w.classList.toggle('hide', !showWait);
  if (showWait) {
    const who = S.L.npc === 'zhang' ? '校長' : '兔兔老師';
    w.classList.toggle('out', !ex.inRoom);
    $('waitText').textContent = ex.inRoom ? `${who}開門中…撐 ${Math.ceil(ex.left)} 秒` : `回撤離點！還要撐 ${Math.ceil(ex.left)} 秒`;
    $('waitBar').style.width = ((1 - ex.left / ex.wait) * 100).toFixed(1) + '%';
  }
}

// ---------- 主迴圈 ----------
function loop(now) { requestAnimationFrame(loop); frame(now); }
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now); T += dt;
  if (!S || !HERO.isReady()) return;
  S.camDy = story ? view.h * 0.14 : 0;
  if (story) CORE.updCam(S, Math.min(1, dt * 5));
  if (mode === 'play') {
    S.input = readInput();
    acc += dt;
    let n = 0;
    while (acc >= 1 / 60 && n < 4) {
      CORE.step(S, 1 / 60); acc -= 1 / 60; n++;
      handleEvents();
      if (mode !== 'play') break;
      if (S.state === 'pick') { showCards(); break; }
    }
    if (n === 4) acc = 0;
  } else if (mode === 'dead' || mode === 'outro') {
    CORE.updCam(S, Math.min(1, dt * 4));
  }
  if (tipT > 0 && (tipT -= dt) <= 0) $('tip').classList.add('hide');
  if (mode === 'talk') {
    const line = talkQ[talkI]; if (line) {
      const prev = Math.floor(typeT); typeT += dt * 28;
      const s = line[1].slice(0, Math.floor(typeT)); if ($('talkText').textContent !== s) { $('talkText').textContent = s; if (Math.floor(typeT) > prev && line[0] !== 'bian') SND.play('talk'); }
    }
  }
  // 3D 角色動作
  const p = S.p;
  const ns = npcs();
  if (story) {
    const near = ns[0];
    HERO.update('bian', dt, T, { speed: 0, face: near ? Math.sign(near.x - p.x) || 1 : 1, front: true });
  } else {
    HERO.update('bian', dt, T, { speed: mode === 'play' ? p.moving / D.PLAYER.h : 0, face: p.face, climb: p.lad != null });
  }
  const vis = ns.filter((n) => Math.abs(n.x - S.cam.x) < view.w / 2 + 120 && Math.abs(n.y - S.cam.y) < view.h / 2 + 200);
  for (const n of ns) HERO.update(n.k, dt, T, { speed: 0, face: n.face, front: true });
  R.draw(S, { t: T, dt, joy: mode === 'play' && joy.on ? toUi(joy) : null, npcs: vis, story: story || mode !== 'play' });
  if (S && mode !== 'title' && mode !== 'select' && mode !== 'loading') hud();
}
const toUi = (j) => ({ bx: j.bx, by: j.by, x: j.bx + Math.max(-54, Math.min(54, j.x - j.bx)), y: j.by + Math.max(-54, Math.min(54, j.y - j.by)) });

// ---------- 開機 ----------
$('bStart').onclick = () => { SND.play('tap'); startLevel(Math.min(save.open, D.LEVELS.length) - 1 >= 0 && save.open > 1 ? save.open - 1 : 0); };
$('bSelect').onclick = () => { SND.play('tap'); goSelect(); };
$('bBack').onclick = () => { SND.play('tap'); goTitle(); };

async function boot() {
  R.init(cv); layout();
  const total = HERO.LOAD_STEPS + R.LOAD_STEPS; let done = 0;
  const tick = () => { done++; $('ldBar').style.width = Math.min(100, done / total * 100) + '%'; };
  try {
    await Promise.all([HERO.init(tick), R.loadImages(tick)]);
  } catch (e) { console.error(e); $('ldText').textContent = '載入失敗，請重新整理'; return; }
  goTitle();
  requestAnimationFrame(loop);
}
boot();

// 測試用
window.G = { get S() { return S; }, get mode() { return mode; }, start: startLevel,
  // 手動跑 sec 秒的畫面（預覽視窗藏起來時 requestAnimationFrame 不會跑）
  run(sec) { for (let i = 0; i < sec * 60; i++) frame(last + 1000 / 60); return mode; },
  // 量一格要畫多久（毫秒）
  prof(n = 20) { const a = performance.now(); for (let i = 0; i < n; i++) R.draw(S, { t: T, dt: 1 / 60, npcs: npcs() }); const b = performance.now(); for (let i = 0; i < n; i++) CORE.step(S, 1 / 60); S.ev.length = 0; return { draw: (b - a) / n, step: (performance.now() - b) / n }; },
  // 快轉 sec 秒（機器人玩、選第一張卡）
  ff(sec) { const end = S.t + sec; while (S.t < end && (S.state === 'play' || S.state === 'pick')) { if (S.state === 'pick') { CORE.choose(S, S.offer[0]); continue; } S.input = window.BOT ? window.BOT(S) : { x: 0, y: 0 }; CORE.step(S, 1 / 60); handleEvents(); } mode = S.state === 'play' ? 'play' : mode; show('hud'); return { t: S.t, mons: S.mons.length, lv: S.p.lv, hp: S.p.hp }; }, give(k, n = 1) { for (let i = 0; i < n; i++) CORE.choose(S, k); }, win() { S.items.forEach((i) => (i.got = true)); S.exit.open = true; S.exit.left = 0.1; S.p.x = S.exit.x; S.p.f = S.exit.f; S.p.y = S.exit.y; } };
