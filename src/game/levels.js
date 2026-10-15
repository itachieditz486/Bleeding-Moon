// Stage data. World units are pixels; the view is 180 px tall so every stage is one screen high.
const GY = 150;
const ground = (x0, x1) => ({ kind: 'stone', x: x0, y: GY, w: x1 - x0, h: 180 - GY });
const block = (x, y, w, h) => ({ kind: 'stone', x, y, w, h });
const plat = (x, y, w) => ({ kind: 'platform', x, y, w, h: 6 });

export const CHECKPOINTS = {
  approach_start: { stage: 0, x: 40, label: 'MOONLIT APPROACH' },
  approach_shrine: { stage: 0, x: 1450, label: 'RUINED BRIDGE SHRINE' },
  hall: { stage: 1, x: 36, label: 'HALL OF THE HOLLOW KNIGHT' },
  corridor_shrine: { stage: 2, x: 700, label: 'DESCENT SHRINE' },
  chamber: { stage: 3, x: 36, label: 'ABYSSAL CHAMBER' },
  throne: { stage: 4, x: 36, label: 'THE SOVEREIGN\'S THRONE' },
};
export const CHECKPOINT_IDS = Object.keys(CHECKPOINTS);
export const BOSS_NAMES = { hollow_knight: 'THE HOLLOW KNIGHT', abyssal_wraith: 'THE ABYSSAL WRAITH', fallen_sovereign: 'THE FALLEN SOVEREIGN' };

export const STAGES = [
  { id: 'approach', name: 'MOONLIT APPROACH', theme: 'approach', area: 'castle_exploration', width: 2800, ground: GY, entry: 40,
    solids: [ground(0, 520), ground(570, 900), block(700, 134, 48, 16), plat(782, 112, 44), ground(900, 1200), plat(1212, 128, 30), ground(1270, 1700),
      plat(1555, 126, 48), plat(1628, 102, 48), ground(1700, 2150), ground(2190, 2800), block(2400, 126, 36, 24)],
    decor: [{ type: 'tree', x: 90, h: 78 }, { type: 'column', x: 300, h: 70, broken: true }, { type: 'tree', x: 640, h: 66 }, { type: 'column', x: 940, h: 56, broken: true },
      { type: 'tree', x: 1100, h: 80 }, { type: 'statue', x: 1380 }, { type: 'column', x: 1520, h: 64 }, { type: 'tree', x: 1790, h: 72 }, { type: 'column', x: 2000, h: 80, broken: true },
      { type: 'tree', x: 2300, h: 70 }, { type: 'column', x: 2560, h: 74 }, { type: 'gate', x: 2740 }],
    shrines: [{ id: 'approach_shrine', x: 1450 }],
    enemies: [{ t: 'ghoul', x: 640, r: [580, 880] }, { t: 'ghoul', x: 980, r: [910, 1190] }, { t: 'wisp', x: 1100, y: 96 }, { t: 'ghoul', x: 1400, r: [1290, 1560] }, { t: 'wisp', x: 1650, y: 78 },
      { t: 'ghoul', x: 1850, r: [1720, 2140] }, { t: 'ghoul', x: 2300, r: [2200, 2500] }, { t: 'wisp', x: 2250, y: 92 }, { t: 'ghoul', x: 2560, r: [2440, 2700] }],
    exit: { x: 2724, w: 32 }, next: 1, boss: null },
  { id: 'hall', name: 'HALL OF THE HOLLOW KNIGHT', theme: 'hall', area: 'hollow_knight_hall', width: 480, ground: GY, entry: 36,
    solids: [ground(0, 480), plat(70, 112, 56), plat(354, 112, 56)],
    decor: [{ type: 'column', x: 120, h: 96 }, { type: 'column', x: 360, h: 96 }, { type: 'torch', x: 60, y: 90 }, { type: 'torch', x: 200, y: 90 }, { type: 'torch', x: 300, y: 90 }, { type: 'torch', x: 440, y: 90 }, { type: 'statue', x: 240 }, { type: 'gate', x: 456 }],
    shrines: [], enemies: [], exit: { x: 440, w: 32 }, next: 2,
    boss: { id: 'hollow_knight', x: 380, trigger: 120, barrierX: 6 } },
  { id: 'corridor', name: 'THE DESCENT', theme: 'corridor', area: 'castle_exploration', width: 1500, ground: GY, entry: 36,
    solids: [ground(0, 420), ground(470, 900), plat(430, 128, 36), ground(940, 1500), plat(600, 112, 48), plat(1080, 110, 48), block(1180, 130, 30, 20)],
    decor: [{ type: 'torch', x: 120, y: 80 }, { type: 'torch', x: 360, y: 80 }, { type: 'torch', x: 640, y: 80 }, { type: 'torch', x: 900, y: 80 }, { type: 'torch', x: 1160, y: 80 }, { type: 'torch', x: 1380, y: 80 },
      { type: 'column', x: 250, h: 100 }, { type: 'statue', x: 520 }, { type: 'column', x: 800, h: 100 }, { type: 'column', x: 1280, h: 100 }, { type: 'gate', x: 1460 }],
    shrines: [{ id: 'corridor_shrine', x: 700 }],
    enemies: [{ t: 'ghoul', x: 300, r: [200, 410] }, { t: 'wisp', x: 520, y: 90 }, { t: 'ghoul', x: 860, r: [780, 890] }, { t: 'ghoul', x: 1000, r: [950, 1200] }, { t: 'wisp', x: 1120, y: 84 }, { t: 'ghoul', x: 1300, r: [1220, 1420] }],
    exit: { x: 1444, w: 32 }, next: 3, boss: null },
  { id: 'chamber', name: 'ABYSSAL CHAMBER', theme: 'chamber', area: 'abyssal_chamber', width: 480, ground: GY, entry: 36,
    solids: [ground(0, 480), plat(70, 118, 52), plat(214, 98, 52), plat(358, 118, 52)],
    decor: [{ type: 'column', x: 130, h: 100 }, { type: 'column', x: 350, h: 100 }, { type: 'torch', x: 60, y: 96 }, { type: 'torch', x: 420, y: 96 }, { type: 'gate', x: 456 }],
    shrines: [], enemies: [], exit: { x: 440, w: 32 }, next: 4,
    boss: { id: 'abyssal_wraith', x: 360, trigger: 120, barrierX: 6 } },
  { id: 'throne', name: 'THE SOVEREIGN\'S THRONE', theme: 'throne', area: 'throne_room', width: 560, ground: GY, entry: 36,
    solids: [ground(0, 560), plat(70, 116, 56), plat(434, 116, 56)],
    decor: [{ type: 'throne', x: 280 }, { type: 'banner', x: 140, y: 24 }, { type: 'banner', x: 420, y: 24 }, { type: 'column', x: 200, h: 110 }, { type: 'column', x: 360, h: 110 }],
    shrines: [], enemies: [], exit: null, next: -1,
    boss: { id: 'fallen_sovereign', x: 450, trigger: 130, barrierX: 6 } },
];
