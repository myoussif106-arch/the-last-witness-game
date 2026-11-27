import data from './data.js';
import { buildLevel, NPCS, PLAYER_START } from './level.js';

export default {
  id: 'case03',
  data,
  npcs: NPCS,
  playerStart: PLAYER_START,
  buildLevel,
  hdri: 'lythwood_room',
  rain: 0.35,
  // [name, x, z, yaw, pitch] camera poses for tools/selftest-case.js
  testViews: [
    ['01_salon', 0.5, -1.0, 1.03, -0.12], ['02_window', -3.5, -4.9, 0, -0.25], ['03_study', 4.6, -2.4, 0.46, -0.15],
    ['04_kitchen', 0.4, 1.9, Math.PI / 2, -0.12], ['05_hall', 2.0, 0.5, -Math.PI / 2, -0.08], ['06_landing', 6.6, -1.5, -2.76, -0.05],
  ],
  loadingTips: [
    'من يعرف السر لا يعني بالضرورة أنه قرأه. ربما سمعه، وربما عاشه.',
    'اسأل دائمًا: ماذا يطلب صاحب الرسالة؟ الطلب يكشف المستفيد.',
    'الورق والصمغ والمجلات تشهد. اقرأ كل ما هو مطبوع، حتى ملصق الاشتراك.',
    'من يجهّز ورقة ضد ضحيته ليس بالضرورة من بدأ اللعبة. ربما وجدها فرصة فقط.',
  ],
};
