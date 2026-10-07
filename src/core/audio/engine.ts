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

// --- Piano ---
// ponytail: piano sintetizado (armónicos con caída de cuerda), sin muestras grabadas. Si hace
// falta que suene a piano de verdad, muestras de un piano libre (2–5 MB más en el precache).

/**
 * Los armónicos de una nota: frecuencia, volumen y cuánto tarda en apagarse (constante de
 * tiempo, en segundos). Los graves suenan más tiempo; los armónicos altos se apagan antes, como
 * en una cuerda. Un poco de inarmonicidad (B) le saca lo "electrónico".
 */
export function pianoPartials(midi: number) {
  const f = midiToFreq(midi);
  const base = Math.min(4, Math.max(0.6, 2.2 * Math.sqrt(261.63 / f)));
  const B = 0.0004;
  return [1, 0.45, 0.25, 0.14, 0.08, 0.04].map((amp, i) => {
    const h = i + 1;
    return { freq: f * h * Math.sqrt(1 + B * h * h), amp, tau: base / h };
  });
}

let out: { volume: GainNode } | undefined;
let volumeValue = 0.8;

/** Salida del piano: volumen y un limitador, así varias notas juntas no saturan. */
function pianoOut() {
  if (!out) {
    const c = audio();
    const volume = c.createGain();
    volume.gain.value = volumeValue;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    volume.connect(limiter).connect(c.destination);
    out = { volume };
  }
  return out;
}

/**
 * Volumen del piano, de 0 a 1. No crea el audio: se aplica cuando suena la primera nota (crear
 * el AudioContext sin un toque del usuario no sirve en iOS y falla donde no hay audio).
 */
export function setPianoVolume(value: number) {
  volumeValue = Math.min(1, Math.max(0, value));
  out?.volume.gain.setTargetAtTime(volumeValue, audio().currentTime, 0.02);
}

/** Una nota de piano que empieza en `at`. Devuelve cómo apagarla (el apagador). */
function pianoVoice(midi: number, at: number) {
  const c = audio();
  const voice = c.createGain();
  voice.gain.value = 0.22; // por nota: con el limitador, un acorde de 4 no satura
  voice.connect(pianoOut().volume);
  const parts = pianoPartials(midi).map(({ freq, amp, tau }) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.005); // martillo
    g.gain.setTargetAtTime(0.0001, at + 0.005, tau);
    osc.connect(g).connect(voice);
    osc.start(at);
    osc.stop(at + 0.005 + tau * 7); // ya inaudible
    return { osc, g };
  });
  return () => {
    const now = c.currentTime;
    for (const { osc, g } of parts) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
      g.gain.setTargetAtTime(0.0001, now, 0.06);
      try {
        osc.stop(now + 0.5);
      } catch {
        // ya terminó sola
      }
    }
  };
}

/**
 * Nota del teclado: suena mientras la tecla está apretada. Devuelve la función que la suelta
 * (con el pedal puesto no se llama y la nota se apaga sola, como en un piano).
 */
export function holdNote(midi: number) {
  return pianoVoice(midi, audio().currentTime);
}

/** Nota para dar el tono: suena `duration` segundos y se apaga. */
export function playNote(midi: number, duration = 1.4, delay = 0) {
  const at = audio().currentTime + delay;
  const release = pianoVoice(midi, at);
  setTimeout(release, (delay + duration) * 1000);
}
