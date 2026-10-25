// 小編萬聖夜：所有數值、關卡、劇情都在這裡（瀏覽器與 node 共用；改完跑 node tools/sim.js 看通關率）
(function (G) {
  // 世界尺寸（px）：一間教室 600×400，樓板 40 厚；小編約 110 高
  const ROOM = { W: 600, H: 400, T: 40 };

  const PLAYER = { hp: 100, spd: 210, climb: 180, r: 26, h: 110, magnet: 90, pick: 60, search: 2 };

  // 升級經驗：第 n 級升到 n+1 要幾顆糖
  const needXp = (lv) => Math.round(3 + lv * 2.2 + lv * lv * 0.08);

  // 怪物：r 半徑、spd 每秒 px、dmg 碰一下扣多少、xp 掉幾顆糖、fly 會飛（穿樓板）
  const MONS = {
    pumpkin: { name: '南瓜仔', img: 'm-pumpkin', hp: 20, spd: 105, r: 22, dmg: 5, xp: 1 },
    bat:     { name: '小蝙蝠', img: 'm-bat', hp: 9, spd: 150, r: 17, dmg: 4, xp: 1, fly: true },
    ghost:   { name: '床單鬼', img: 'm-ghost', hp: 46, spd: 70, r: 25, dmg: 7, xp: 2, fly: true },
    mummy:   { name: '衛生紙木乃伊', img: 'm-mummy', hp: 120, spd: 62, r: 27, dmg: 10, xp: 4 },
    boss:    { name: '南瓜大王', img: 'm-boss', hp: 16000, spd: 42, r: 74, dmg: 20, xp: 60, boss: true },
  };

  // 技能：kind w＝武器、p＝被動；lv 是每一級的數值（1～5 級），desc 是卡片上的說明
  const SKILLS = {
    candy: { name: '粉筆連發', icon: 0, kind: 'w',
      lv: [{ cd: .6, n: 1, dmg: 20, pierce: 0 }, { cd: .55, n: 2, dmg: 22, pierce: 0 }, { cd: .5, n: 2, dmg: 26, pierce: 1 }, { cd: .45, n: 3, dmg: 30, pierce: 1 }, { cd: .38, n: 4, dmg: 36, pierce: 2 }],
      desc: ['自動朝最近的怪丟粉筆', '一次丟 2 根', '更痛，可以穿過 1 隻', '一次丟 3 根', '一次 4 根，穿過 2 隻'] },
    glow: { name: '跳繩', icon: 1, kind: 'w',
      lv: [{ n: 2, len: 150, spd: 3.2, dmg: 12 }, { n: 3, len: 155, spd: 3.4, dmg: 14 }, { n: 3, len: 175, spd: 3.8, dmg: 18 }, { n: 4, len: 185, spd: 4.1, dmg: 22 }, { n: 5, len: 205, spd: 4.5, dmg: 28 }],
      desc: ['甩跳繩，繩子繞著身體轉', '變 3 條', '更長、甩更快', '變 4 條', '5 條，又長又痛'] },
    bomb: { name: '躲避球', icon: 2, kind: 'w',
      lv: [{ cd: 2.6, n: 1, dmg: 36, r: 110 }, { cd: 2.3, n: 2, dmg: 40, r: 115 }, { cd: 2.1, n: 2, dmg: 50, r: 130 }, { cd: 1.9, n: 3, dmg: 58, r: 140 }, { cd: 1.6, n: 4, dmg: 70, r: 155 }],
      desc: ['往怪最多的地方砸躲避球', '一次丟 2 顆', '砸得更大更痛', '一次丟 3 顆', '一次 4 顆'] },
    flash: { name: '體育哨子', icon: 3, kind: 'w',
      lv: [{ cd: 4.2, r: 190, dmg: 18, stun: .6 }, { cd: 3.8, r: 210, dmg: 24, stun: .7 }, { cd: 3.4, r: 225, dmg: 30, stun: .8 }, { cd: 3, r: 240, dmg: 38, stun: .9 }, { cd: 2.5, r: 265, dmg: 48, stun: 1 }],
      desc: ['嗶！周圍的怪被嚇到定住', '範圍更大', '更痛、定更久', '吹得更勤', '超大聲'] },
    beam: { name: '竹掃把', icon: 4, kind: 'w',
      lv: [{ cd: 3.2, n: 1, len: 620, w: 34, dps: 110, dur: .6 }, { cd: 3, n: 2, len: 650, w: 36, dps: 120, dur: .65 }, { cd: 2.7, n: 2, len: 700, w: 42, dps: 150, dur: .7 }, { cd: 2.4, n: 3, len: 740, w: 44, dps: 170, dur: .75 }, { cd: 2, n: 4, len: 800, w: 50, dps: 210, dur: .8 }],
      desc: ['大掃除！掃把一揮掃過一整排', '一次 2 把', '掃把更大更痛', '一次 3 把', '一次 4 把'] },
    buddy: { name: '扯鈴', icon: 5, kind: 'w',
      lv: [{ n: 1, cd: 1.0, dmg: 14 }, { n: 2, cd: .95, dmg: 15 }, { n: 2, cd: .75, dmg: 20 }, { n: 3, cd: .7, dmg: 22 }, { n: 4, cd: .55, dmg: 26 }],
      desc: ['扯鈴在身邊轉，飛出去撞怪再回來', '變 2 個', '飛得更快更痛', '變 3 個', '4 個一起飛'] },
    thunder: { name: '紙飛機', icon: 6, kind: 'w',
      lv: [{ cd: 3, n: 1, dmg: 48, r: 70 }, { cd: 2.7, n: 2, dmg: 52, r: 75 }, { cd: 2.4, n: 3, dmg: 62, r: 85 }, { cd: 2.1, n: 4, dmg: 72, r: 90 }, { cd: 1.7, n: 5, dmg: 90, r: 100 }],
      desc: ['紙飛機俯衝，隨機砸畫面裡的怪', '一次 2 架', '一次 3 架', '一次 4 架', '一次 5 架'] },
    brew: { name: '拖地水桶', icon: 7, kind: 'w',
      lv: [{ cd: 1.6, dur: 3, r: 72, dps: 26, slow: .4 }, { cd: 1.5, dur: 3.6, r: 80, dps: 32, slow: .45 }, { cd: 1.4, dur: 4.2, r: 90, dps: 40, slow: .5 }, { cd: 1.3, dur: 4.8, r: 98, dps: 48, slow: .55 }, { cd: 1.1, dur: 5.5, r: 110, dps: 60, slow: .6 }],
      desc: ['走過的地方拖得濕濕的，怪會滑倒變慢', '水留更久', '拖更大片', '更滑', '整條走廊都濕了'] },
    frost: { name: '電風扇', icon: 8, kind: 'w',
      lv: [{ r: 150, slow: .3, dps: 8 }, { r: 170, slow: .35, dps: 12 }, { r: 190, slow: .42, dps: 16 }, { r: 210, slow: .5, dps: 22 }, { r: 235, slow: .58, dps: 30 }],
      desc: ['身邊一直吹強風，靠近的怪走很慢', '範圍更大', '風更強', '更強更大', '開到最強段'] },
    hero: { name: '針筒超人', icon: 'hero', kind: 'w',
      lv: [{ dmg: 40, r: 95, spd: 520 }, { dmg: 52, r: 100, spd: 560 }, { dmg: 64, r: 112, spd: 600 }, { dmg: 78, r: 120, spd: 640 }, { dmg: 96, r: 135, spd: 700 }],
      desc: ['校長來幫忙！變身針筒超人打 20 秒，變回校長休息 20 秒，一直輪流', '撞得更痛', '撞更大片', '飛更快更痛', '最強針筒超人'] },
    cape: { name: '書包護盾', icon: 9, kind: 'p',
      lv: [{ n: 1, cd: 9 }, { n: 1, cd: 7 }, { n: 2, cd: 7 }, { n: 2, cd: 5.5 }, { n: 3, cd: 5 }],
      desc: ['擋掉 1 次攻擊，會自己充好', '充得更快', '可以擋 2 次', '充得更快', '可以擋 3 次'] },
    shoe: { name: '室內鞋', icon: 10, kind: 'p', lv: [{ m: 1.1 }, { m: 1.18 }, { m: 1.26 }, { m: 1.33 }, { m: 1.4 }],
      desc: ['跑快 10%', '跑快 18%', '跑快 26%', '跑快 33%', '跑快 40%'] },
    bento: { name: '營養午餐', icon: 11, kind: 'p', lv: [{ hp: 25 }, { hp: 50 }, { hp: 75 }, { hp: 100 }, { hp: 130 }],
      desc: ['血量上限 +25，補滿血', '再 +25，補滿血', '再 +25，補滿血', '再 +25，補滿血', '再 +30，補滿血'] },
    magnet: { name: '乖寶寶印章', icon: 12, kind: 'p', lv: [{ m: 1.15 }, { m: 1.3 }, { m: 1.45 }, { m: 1.6 }, { m: 1.8 }],
      desc: ['撿到的糖果多算 15%，升級更快', '多 30%', '多 45%', '多 60%', '多 80%'] },
    clock: { name: '上課鐘', icon: 13, kind: 'p', lv: [{ m: .92 }, { m: .85 }, { m: .79 }, { m: .73 }, { m: .66 }],
      desc: ['所有武器快 8%', '快 15%', '快 21%', '快 27%', '快 34%'] },
  };
  const MAXLV = 5;

  // 收集品（items 圖的格子編號）
  const ITEMS = {
    lantern: { name: '南瓜燈', icon: 0 }, bucket: { name: '糖果桶', icon: 1 }, mic: { name: '麥克風', icon: 2 },
    hat: { name: '巫婆帽', icon: 3 }, bunting: { name: '蝙蝠彩旗', icon: 4 }, bell: { name: '手搖鈴', icon: 5 },
    cape: { name: '表演披風', icon: 6 }, camera: { name: '老相機', icon: 7 }, radio: { name: '收音機', icon: 8 },
    lolli: { name: '大棒棒糖', icon: 9 }, cookie: { name: '餅乾罐', icon: 10 }, lights: { name: '小燈泡', icon: 11 },
    banner: { name: '晚會布條', icon: 12 }, ears: { name: '兔耳髮箍', icon: 13 }, trophy: { name: '班際獎盃', icon: 14 },
  };
  const CHEST_ICON = 15;

  // 關卡：rooms 由上到下每層的教室；ladders [樓層, 欄]＝從這層爬到上一層的梯子（欄 0.5＝第一間正中間）
  // items/chests [樓層, 欄]；start、exit [樓層, 欄]；waves：rate 每秒生幾隻（隨時間加）、mix 各種怪的比重（from 秒開始出現）
  const LEVELS = [
    { name: '一年級教室', sub: '先熟悉一下怎麼走', story: 'l1', wait: 30,
      rooms: ['class hall class music', 'class class hall library', 'hall gym hall class'],
      ladders: [[0, 0.5], [0, 3.5], [1, 2.5]],
      items: [['lantern', 2, 0.5], ['bucket', 1, 3.6], ['mic', 2, 3.5]], chests: [[1, 1.5]],
      start: [0, 1.5], exit: [0, 1.5], npc: 'tu',
      waves: { rate: 1.0, grow: 1.0, cap: 120, mix: [['pumpkin', 10, 0], ['bat', 3, 45]], horde: 50, hordeN: 16 } },
    { name: '自然教室', sub: '床單鬼會穿牆', story: 'l2', wait: 40,
      rooms: ['nurse lab hall class', 'lab hall class nurse', 'class nurse lab hall', 'hall lab hall class'],
      ladders: [[0, 3.5], [1, 0.5], [1, 2.5], [2, 3.5]],
      items: [['hat', 3, 0.5], ['bunting', 1, 3.5], ['bell', 2, 0.5]], chests: [[2, 2.5], [3, 3.5]],
      start: [0, 0.5], exit: [0, 0.5], npc: 'tu',
      waves: { rate: 1.9, grow: 1.9, cap: 170, mix: [['pumpkin', 10, 0], ['bat', 4, 20], ['ghost', 3, 40]], horde: 42, hordeN: 28 } },
    { name: '圖書室與音樂教室', sub: '木乃伊很耐打', story: 'l3', wait: 45,
      rooms: ['library music hall library class', 'music hall library class music', 'hall class music hall library', 'class library hall music hall'],
      ladders: [[0, 0.5], [0, 4.5], [1, 2.5], [2, 0.5], [2, 4.5]],
      items: [['cape', 3, 4.5], ['camera', 2, 2.5], ['radio', 1, 0.5]], chests: [[1, 3.5], [3, 1.5]],
      start: [0, 2.5], exit: [0, 2.5], npc: 'zhang',
      waves: { rate: 2.3, grow: 2.2, cap: 190, mix: [['pumpkin', 10, 0], ['bat', 4, 0], ['ghost', 3, 30], ['mummy', 2, 60]], horde: 40, hordeN: 34 } },
    { name: '校長室那一棟', sub: '怪越來越多', story: 'l4', wait: 50,
      rooms: ['office hall class lab library', 'class music hall library hall', 'hall lab class hall nurse', 'library hall nurse class music', 'hall class gym hall lab'],
      ladders: [[0, 0.5], [0, 4.5], [1, 2.5], [2, 0.5], [2, 4.5], [3, 2.5]],
      items: [['lolli', 1, 4.5], ['cookie', 3, 0.5], ['lights', 2, 2.5]], chests: [[1, 0.5], [3, 3.5], [4, 4.5]],
      start: [0, 2.5], exit: [4, 0.5], npc: 'zhang',
      waves: { rate: 2.7, grow: 2.5, cap: 210, mix: [['pumpkin', 10, 0], ['bat', 5, 0], ['ghost', 4, 20], ['mummy', 3, 45]], horde: 38, hordeN: 40 } },
    { name: '頂樓萬聖晚會', sub: '南瓜大王出現了', story: 'l5', wait: 0, boss: true,
      rooms: ['roof roof roof roof roof', 'class hall music library hall', 'lab class hall office class', 'hall library class nurse music', 'gym hall lab hall class'],
      ladders: [[0, 2.5], [1, 0.5], [1, 4.5], [2, 2.5], [3, 0.5], [3, 4.5]],
      items: [['banner', 3, 2.5], ['ears', 2, 0.5], ['trophy', 1, 4.5]], chests: [[1, 2.5], [2, 4.5], [3, 1.5]],
      start: [0, 0.5], exit: [4, 2.5], npc: 'both',
      waves: { rate: 3.0, grow: 2.8, cap: 220, mix: [['pumpkin', 10, 0], ['bat', 5, 0], ['ghost', 4, 0], ['mummy', 4, 30]], horde: 36, hordeN: 46 } },
  ];

  // 劇情：每關開場 intro、過關 outro；who: bian 小編、tu 兔兔老師、zhang 校長
  const STORY = {
    l1: {
      intro: [['tu', '小編～今晚萬聖節晚會，南瓜燈、糖果桶跟麥克風都還放在樓上教室！'], ['bian', '五點了，我要下班。'], ['tu', '可是……教室裡好像跑出好多南瓜仔耶，拜託你嘛～'], ['bian', '……好啦，拿完就下班。']],
      outro: [['tu', '哇！三樣都拿回來了，小編最可靠了～'], ['bian', '那我可以下班了嗎？'], ['tu', '還不行喔，自然教室那邊還有東西沒拿～']] },
    l2: {
      intro: [['tu', '自然教室借的巫婆帽、蝙蝠彩旗，還有上課用的手搖鈴，都要拿回來。'], ['tu', '聽說保健室那邊有白白的東西在飄……'], ['bian', '那是床單吧。'], ['tu', '床單會自己飄嗎？']],
      outro: [['tu', '辛苦了！床單鬼沒有嚇到你吧？'], ['bian', '有。'], ['tu', '接下來去圖書室，校長在那邊等你喔。']] },
    l3: {
      intro: [['zhang', '小編啊，各位同學，校長說幾句話就好。'], ['zhang', '表演披風、老相機、收音機，都在圖書室跟音樂教室，校長年紀大了爬不上去。'], ['bian', '校長，您剛剛自己走上來的。'], ['zhang', '……那個，木乃伊很耐打，小心喔。']],
      outro: [['zhang', '好，很好！校長再說幾句話就好……'], ['bian', '（默默走向下一棟）'], ['zhang', '欸，校長還沒講完——']] },
    l4: {
      intro: [['zhang', '晚會的點心，大棒棒糖跟餅乾罐，校長收在校長室那一棟。'], ['zhang', '還有布置用的小燈泡，在三樓。拿齊了就上五樓校長室找校長。'], ['bian', '為什麼點心收在校長室？'], ['zhang', '……校長說幾句話就好，快去快回。']],
      outro: [['zhang', '點心都在！今晚一定很熱鬧。'], ['tu', '頂樓已經布置好一半了，就差最後三樣～'], ['bian', '最後三樣，然後下班。']] },
    l5: {
      intro: [['tu', '晚會布條、兔兔的兔耳髮箍，還有班際獎盃，拿上來就能開晚會了！'], ['zhang', '頂樓好像有個很大的南瓜，校長覺得不太對勁……'], ['bian', '那個南瓜戴著皇冠。'], ['tu', '小編加油！打倒南瓜大王，我們在頂樓等你～']],
      outro: [['tu', '萬聖節晚會開始囉～謝謝小編！'], ['zhang', '各位同學，校長說幾句話就好——'], ['bian', '五點了，我要下班。'], ['tu', '現在是晚上九點啦！']] },
  };

  const NAMES = { bian: '小編', tu: '兔兔老師', zhang: '校長' };

  G.DATA = { ROOM, PLAYER, needXp, MONS, SKILLS, MAXLV, ITEMS, CHEST_ICON, LEVELS, STORY, NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
