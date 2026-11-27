import data from './data.js';
import { buildLevel, NPCS, PLAYER_START } from './level.js';

export default {
  id: 'case05',
  data,
  npcs: NPCS,
  playerStart: PLAYER_START,
  buildLevel,
  hdri: 'lythwood_room',
  rain: 0.6,
  // [name, x, z, yaw, pitch] camera poses for tools/selftest-case.js
  testViews: [
    ['01_shop', 0.0, 3.35, 0, -0.08], ['02_counter', 2.6, 2.4, 0.9, -0.2], ['03_west', 1.5, 2.0, 1.4, -0.05],
    ['04_brass', 2.6, 1.9, -Math.PI / 2, -0.1], ['05_back', 3.6, -2.6, 0.75, -0.12], ['06_bench', 1.0, -4.8, 0, -0.35], ['07_front', 0.5, -0.9, Math.PI, 0],
  ],
  loadingTips: [
    'الملف القديم كتبه أناس قرروا النهاية قبل أن يبدأوا. اقرأ ما وضعوه في آخره.',
    'الساعة التي توقفت تشهد بالدقيقة. التقدير ليس شهادة.',
    'الشاهد الذي سكت طويلًا قد يكون سكت لسبب. ابحث عمّن يدفع ثمن سكوته.',
    'ما لم يُعثر عليه قد يكون في مكانه تمامًا، لكن بلون مختلف.',
  ],
};
