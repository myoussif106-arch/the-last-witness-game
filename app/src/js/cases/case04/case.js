import data from './data.js';
import { buildLevel, NPCS, PLAYER_START } from './level.js';

export default {
  id: 'case04',
  data,
  npcs: NPCS,
  playerStart: PLAYER_START,
  buildLevel,
  hdri: 'lythwood_room',
  rain: 0.8,
  // [name, x, z, yaw, pitch] camera poses for tools/selftest-case.js
  testViews: [
    ['01_corridor', 7.3, 1.1, Math.PI / 2, -0.05], ['02_lift', -5.5, 1.1, Math.PI / 2, -0.08], ['03_room309', 2.9, 0.4, 0.5, -0.2],
    ['04_room307', -4.8, -0.2, 0.9, -0.15], ['05_room308', -1.4, -0.3, 0.7, -0.15], ['06_room310', 4.3, -0.3, -0.5, -0.15],
    ['07_alcove', 1.3, 1.0, Math.PI, -0.1], ['08_stairs', 8.4, 0.9, -2.6, -0.3],
  ],
  loadingTips: [
    'الشاهد الواثق ليس بالضرورة شاهدًا صادقًا. اسأل: كيف رأى؟ ومن أين؟',
    'السجلات الآلية لا تكذب، لكنها لا تقول من كان يحمل البطاقة.',
    'كل كذبة صغيرة تخفي شيئًا. أحيانًا سيجارة ممنوعة، وأحيانًا جريمة.',
    'الشيء المسروق الذي لم يخرج من المبنى ما زال ينتظر صاحبه الجديد.',
  ],
};
