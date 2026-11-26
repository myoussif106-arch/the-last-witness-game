import data from './data.js';
import { buildLevel, NPCS, PLAYER_START } from './level.js';

export default {
  id: 'case01',
  data,
  npcs: NPCS,
  playerStart: PLAYER_START,
  buildLevel,
  hdri: 'lythwood_room',
  loadingTips: [
    'الأقوال تتغير حين تواجه الناس بالأدلة. لا تكتفِ بالسؤال.',
    'ليس كل كاذب مذنبًا. بعض الناس يكذبون لأسباب صغيرة.',
    'اربط بين الأدلة على اللوحة: الخيط الصحيح يكشف استنتاجًا جديدًا.',
    'ما تُرك في مسرح الجريمة قد يكون أهم مما أُخذ.',
  ],
};
