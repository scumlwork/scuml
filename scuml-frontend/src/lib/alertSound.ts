// scuml-frontend/src/lib/alertSound.ts
// A short, synthesized two-note "ding" for new-message notifications — no
// audio asset to host, just the Web Audio API. Browsers block audio
// playback before the user has interacted with the page at all, so the
// AudioContext is created lazily and "unlocked" (resumed) on the first
// click/keypress anywhere on the page.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  };
  window.addEventListener("click", unlock);
  window.addEventListener("keydown", unlock);
}

// Two quick sine-wave tones (a rising "ding-dong") — pleasant, short,
// unmistakable without being jarring.
export function playMessageAlert() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const playTone = (freq: number, start: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.25, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration);
  };

  playTone(880, 0, 0.16); // A5
  playTone(1174.66, 0.13, 0.22); // D6
}
