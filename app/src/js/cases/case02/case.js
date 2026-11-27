import data from './data.js';
import { buildLevel, restore, NPCS, PLAYER_START } from './level.js';

export default {
  id: 'case02',
  data,
  npcs: NPCS,
  playerStart: PLAYER_START,
  buildLevel,
  restore,
  hdri: 'lythwood_room',
  rain: 0.45,
  loadingTips: [
    'حين يروي ثلاثة أشخاص ثلاث قصص، ابحث عن التفصيل الذي لا يمكن أن يصدق في القصص كلها معًا.',
    'الأشياء الصغيرة تشهد أيضًا: كوب، مفتاح، مكالمة لم يرد عليها أحد.',
    'ليس كل من يكذب يخفي جريمة. بعضهم يخفي مقابلة عمل أو مكالمة مع خطيبته.',
    'دليل يُترك ليُرى أولًا قد يكون موضوعًا هناك عن قصد.',
  ],
};
