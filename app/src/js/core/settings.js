export const DEFAULT_SETTINGS = {
  master: 0.8, music: 0.45, sfx: 0.8, ambient: 0.7, voice: 0.95,
  sensitivity: 1.0, invertY: false, fov: 70,
  quality: 'high',          // low | medium | high | ultra
  postfx: true, shadows: true,
  textSpeed: 1.0, hints: true, fullscreen: false, headBob: true,
};

export const QUALITY = {
  low:    { pixelRatio: 0.7, maxPR: 0.75, shadowSize: 512,  ao: false, bloom: false, shadowLights: 1, aa: false },
  medium: { pixelRatio: 0.85, maxPR: 0.9, shadowSize: 1024, ao: false, bloom: true,  shadowLights: 2, aa: true },
  high:   { pixelRatio: 1.0, maxPR: 1.0, shadowSize: 1024, ao: false, bloom: true,  shadowLights: 3, aa: true },
  ultra:  { pixelRatio: 1.0, maxPR: 2.0, shadowSize: 2048, ao: true,  bloom: true,  shadowLights: 4, aa: true },
};

export const QUALITY_LABELS = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', ultra: 'فائقة' };
