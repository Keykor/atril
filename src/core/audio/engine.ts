import { midiToFreq } from './notes';

let ctx: AudioContext | undefined;

/** AudioContext único. Hay que llamarlo desde un toque la primera vez (política de autoplay). */
export function audio() {
  if (!ctx) {
    // iOS: sin esto Web Audio queda mudo con el switch de silencio. Tiene que setearse
    // antes de crear el AudioContext.
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    ctx = new AudioContext({ latencyHint: 'interactive' });
  }
  if (ctx.state !== 'running') void ctx.resume();
  return ctx;
}

/** Click del metrónomo: un pulso corto, más agudo en el primer tiempo. */
export function click(time: number, accent: boolean) {
  const c = audio();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = accent ? 1600 : 1000;
  gain.gain.setValueAtTime(accent ? 0.9 : 0.6, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(gain).connect(c.destination);
  osc.start(time);
  osc.stop(time + 0.06);
}

/** Nota para dar el tono: ataque inmediato y caída suave. */
export function playNote(midi: number, duration = 1.4, delay = 0) {
  const c = audio();
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(midi);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}
