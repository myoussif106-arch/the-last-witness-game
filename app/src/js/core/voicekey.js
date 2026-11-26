// Stable key for a spoken line, shared by the game and tools/voices.mjs.
// The key changes whenever the text changes, so edited lines get re-voiced automatically.
export function voiceKey(npc, text) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${npc}_${h.toString(16).padStart(8, '0')}`;
}
