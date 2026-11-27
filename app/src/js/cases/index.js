// Registry of all cases. `module` is loaded on demand; cases without a module are still being written.
export const CASES = [
  { id: 'case01', num: 1, title: 'الشقة المغلقة', difficulty: 1, module: './case01/case.js',
    teaser: 'ساعة ذهبية ودفتر أسود اختفيا من شقة مقفلة لم يُكسر بابها. سرقة بسيطة... أم شيء آخر؟' },
  { id: 'case02', num: 2, title: 'اختفاء الموظف', difficulty: 2, module: './case02/case.js',
    teaser: 'محاسب يغادر مكتبه في منتصف النهار ولا يعود. زملاؤه يروون ثلاث قصص لا تتطابق.' },
  { id: 'case03', num: 3, title: 'الرسالة المجهولة', difficulty: 2, module: './case03/case.js',
    teaser: 'رسائل بلا توقيع تصل كل أسبوع إلى معلمة متقاعدة. من يعرف كل هذه الأسرار؟' },
  { id: 'case04', num: 4, title: 'الفندق', difficulty: 3, module: './case04/case.js',
    teaser: 'نزيل يُعثر عليه فاقدًا للوعي في الغرفة 309. خمسة شهود، وخمس روايات.' },
  { id: 'case05', num: 5, title: 'القضية القديمة', difficulty: 3, module: './case05/case.js',
    teaser: 'ملف أُغلق قبل اثنتي عشرة سنة. شهادة واحدة لم يقرأها أحد بعناية.' },
  { id: 'case06', num: 6, title: 'الشاهد المتناقض', difficulty: 4, module: null,
    teaser: 'شاهد غيّر أقواله ثلاث مرات. أيّ رواية هي الحقيقة؟ وما الذي يخيفه؟' },
  { id: 'case07', num: 7, title: 'السرقة الغامضة', difficulty: 4, module: null,
    teaser: 'خزنة فُتحت داخل غرفة لا مدخل لها إلا من باب واحد تحت المراقبة.' },
  { id: 'case08', num: 8, title: 'القصر', difficulty: 5, module: null,
    teaser: 'ليلة عشاء عائلي في قصر قديم تنتهي بجريمة. كل الحاضرين لديهم سبب.' },
  { id: 'case09', num: 9, title: 'الملف المفقود', difficulty: 5, module: null,
    teaser: 'ملف يربط بين قضاياك السابقة يختفي من الأرشيف. أحدهم يعرف ما كشفته.' },
  { id: 'case10', num: 10, title: 'الشاهد الأخير', difficulty: 5, module: null,
    teaser: 'كل الخيوط تلتقي هنا. شاهد واحد بقي على قيد الحياة، وعليك أن تصل إليه أولًا.' },
];

export async function loadCase(id) {
  const meta = CASES.find(c => c.id === id);
  if (!meta || !meta.module) return null;
  const mod = await import(meta.module);
  return mod.default;
}
