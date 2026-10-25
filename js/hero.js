// 3D 角色：小編（玩家）、兔兔老師與校長（只在劇情和撤離點出現）
// 用一個小的 WebGL 畫布輪流畫每個角色，再貼到 2D 主畫面上（2D 畫面負責校舍、怪物、特效）
import * as THREE from 'three';
import { loadKind, loadClip, makeActor, updateActor, addJog } from './assets.js?v=2';

const SZ = 256;
const VIEW = 1.5;            // 正交鏡頭看 1.5 單位寬高（角色 1 單位高）
const FOOT = 0.12;           // 腳底離畫布底部幾成
let R = null, scene, cam, ready = false;
const K = {}, CL = {}, A = {};
let tint = null, tg = null;

export async function init(tick = () => {}) {
  R = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  R.setPixelRatio(1); R.setSize(SZ, SZ, false);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3226, 2.1));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.9); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa24a, 0.9); rim.position.set(-3, 2, -2); scene.add(rim);   // 南瓜燈的暖色輪廓光
  cam = new THREE.OrthographicCamera(-VIEW / 2, VIEW / 2, VIEW * (1 - FOOT), -VIEW * FOOT, 0.1, 30);
  cam.position.set(0, 0, 8); cam.lookAt(0, 0, 0);   // 正交鏡頭的上下界是相對鏡頭位置，鏡頭放在腳底高度
  tint = document.createElement('canvas'); tint.width = tint.height = SZ; tg = tint.getContext('2d');

  const kinds = [['bian', 'bian_walk'], ['bianJog', 'bian_jog', 7], ['tu', 'tu_walk'], ['zhang', 'zhang_walk'], ['needle', 'needle_walk'], ['needleJog', 'needle_jog', 7]];
  const clips = [['sig_bian', 'sig/bian'], ['sig_tu', 'sig/tu'], ['sig_zhang', 'sig/zhang'], ['stumble', 'moves/stumble'], ['handsup', 'moves/handsup'], ['hop', 'moves/hop']];
  await Promise.all([
    ...kinds.map(async ([k, f, lean]) => { K[k] = await loadKind(`models/${f}.glb`, lean ?? null); tick(); }),
    ...clips.map(async ([k, f]) => { try { CL[k] = await loadClip(`models/${f}.glb`); } catch (e) { console.warn(k, e); } tick(); }),
  ]);
  for (const k of ['bian', 'tu', 'zhang', 'needle']) {
    const a = makeActor(K[k], 1);
    if (k === 'bian' && K.bianJog) addJog(a, K.bianJog);
    if (k === 'needle' && K.needleJog) addJog(a, K.needleJog);
    a.root.visible = false; scene.add(a.root);
    a.key = k; a.face = 1; a.rot = 0; A[k] = a;
  }
  ready = true;
}
export const isReady = () => ready;
export const LOAD_STEPS = 12;

// 角色站姿截圖（升級卡的圖示用）
export function snapshot(k, face = 0.35) {
  const a = A[k]; if (!a) return '';
  const r = a.root.rotation.y; a.root.rotation.y = face;
  for (const kk in A) A[kk].root.visible = kk === k;
  R.render(scene, cam); const url = R.domElement.toDataURL('image/png');
  a.root.rotation.y = r; return url;
}

// 播一段動作（loop：一直播，像勝利歡呼；不然播一次就回走路）
export function act(k, clip, loop = false) {
  const a = A[k]; if (!a || !CL[clip]) return;
  if (a.sig) a.sig.stop();
  a.sig = a.mixer.clipAction(CL[clip]); a.sig.reset();
  a.sig.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); a.sig.clampWhenFinished = true;
  a.sig.play(); a.sigOn = true; a.sigLoop = loop; a.sigClip = clip;
}
export function stopAct(k) { const a = A[k]; if (a) a.sigOn = false; }

// 每幀：speed 每秒幾個身高、face 1 右 -1 左、climb 背對鏡頭爬梯
export function update(k, dt, t, o) {
  const a = A[k]; if (!a) return;
  a.speed = o.speed || 0;
  a.forceJog = o.speed > 1.4 ? 1 : null;
  if (a.sig && a.sigOn && !a.sigLoop && a.sig.time >= a.sig.getClip().duration - 0.05) a.sigOn = false;
  // 側面 3/4 角度（不要整個側過去，臉才看得到）；爬梯子背對鏡頭
  const want = o.climb ? Math.PI : (o.face ?? 1) * (o.front ? 0.35 : 1.05);
  let d = want - a.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
  a.rot += d * Math.min(1, dt * 12);
  a.root.rotation.y = a.rot;
  updateActor(a, dt, t);
}

// 畫到 2D 主畫面：x、y 是腳底的世界座標，h 是角色高（世界 px）
export function draw(ctx, k, x, y, h, o = {}) {
  const a = A[k]; if (!a || !ready) return;
  for (const kk in A) A[kk].root.visible = kk === k;
  R.render(scene, cam);
  const size = h * VIEW;   // 畫布對應的世界大小
  let src = R.domElement;
  if (o.red || o.white) {
    tg.clearRect(0, 0, SZ, SZ); tg.globalCompositeOperation = 'source-over'; tg.drawImage(src, 0, 0);
    tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = o.red ? `rgba(255,40,30,${o.red})` : `rgba(255,255,255,${o.white})`; tg.fillRect(0, 0, SZ, SZ);
    src = tint;
  }
  ctx.drawImage(src, x - size / 2, y - size * (1 - FOOT), size, size);
}
