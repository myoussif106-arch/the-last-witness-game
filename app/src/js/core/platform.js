// Platform detection: desktop (Electron), Android app (Capacitor) or a touch browser.
const params = new URLSearchParams(location.search);
export const isNativeMobile = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
export const isTouch = params.has('touch') || isNativeMobile || (!window.native && matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
if (isTouch) document.documentElement.classList.add('touch');
