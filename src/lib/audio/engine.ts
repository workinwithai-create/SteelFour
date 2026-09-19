import { chordAt } from "@/lib/music/grooves";
import type { ChairMutes, Groove, PlayMode, Recipe } from "@/lib/music/types";
import { STEPS, TOTAL_BARS, chairOn } from "@/lib/music/types";

const PRE = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@main/public/samples";
const GM = "https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM";

const FILES: [string, string, number][] = [
  ["kick", `${PRE}/drums/kick.mp3`, 0],
  ["snare", `${PRE}/drums/snare.mp3`, 0],
  ["hat", `${PRE}/drums/hihat.mp3`, 0],
  ["pC3", `${PRE}/piano/C3.mp3`, 48],
  ["pC4", `${PRE}/piano/C4.mp3`, 60],
  ["pA3", `${PRE}/piano/A3.mp3`, 57],
  ["bE1", `${PRE}/bass/E1.mp3`, 28],
  ["bA1", `${PRE}/bass/A1.mp3`, 33],
  ["bC2", `${PRE}/bass/C2.mp3`, 36],
  ["gE2", `${GM}/acoustic_guitar_steel-mp3/E2.mp3`, 40],
  ["gA2", `${GM}/acoustic_guitar_steel-mp3/A2.mp3`, 45],
  ["gD3", `${GM}/acoustic_guitar_steel-mp3/D3.mp3`, 50],
  ["gG3", `${GM}/acoustic_guitar_steel-mp3/G3.mp3`, 55],
  ["gB3", `${GM}/acoustic_guitar_steel-mp3/B3.mp3`, 59],
  ["gE4", `${GM}/acoustic_guitar_steel-mp3/E4.mp3`, 64],
  ["gA4", `${GM}/acoustic_guitar_steel-mp3/A4.mp3`, 69],
  ["gD5", `${GM}/acoustic_guitar_steel-mp3/D5.mp3`, 74],
];

type Voice = "kick" | "snare" | "hat" | "piano" | "bass" | "steel";

export type Hit = {
  voice: Voice;
  midi?: number;
  gain: number;
  rate?: number;
  offset?: number;
  dur?: number;
};

function rateFromMidi(midi: number, base: number) {
  return 2 ** ((midi - base) / 12);
}

function pickPiano(midi: number): [string, number] {
  if (midi < 54) return ["pC3", 48];
  if (midi < 59) return ["pA3", 57];
  return ["pC4", 60];
}

function pickBass(midi: number): [string, number] {
  if (midi < 31) return ["bE1", 28];
  if (midi < 35) return ["bA1", 33];
  return ["bC2", 36];
}

function pickSteel(midi: number): [string, number] {
  const points: [string, number][] = [
    ["gE2", 40],
    ["gA2", 45],
    ["gD3", 50],
    ["gG3", 55],
    ["gB3", 59],
    ["gE4", 64],
    ["gA4", 69],
    ["gD5", 74],
  ];
  let best = points[0]!;
  let bestDist = Math.abs(midi - best[1]);
  for (const p of points) {
    const d = Math.abs(midi - p[1]);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

function dryHits(groove: Groove, barIndex: number, step: number): Hit[] {
  const ch = chordAt(groove, barIndex);
  const hits: Hit[] = [];
  if (step === 0) hits.push({ voice: "kick", gain: 0.5 });
  if (step === 8) hits.push({ voice: "snare", gain: 0.28 });
  if (step % 4 === 2) hits.push({ voice: "hat", gain: 0.04 });
  if (step === 0) {
    hits.push({ voice: "piano", midi: ch.piano[2] ?? 60, gain: 0.12 });
    hits.push({ voice: "piano", midi: ch.piano[1] ?? 57, gain: 0.08 });
    hits.push({ voice: "bass", midi: ch.bass, gain: 0.38 });
  }
  if (step === 8) hits.push({ voice: "bass", midi: ch.bass, gain: 0.22 });
  return hits;
}

function steelLayer(
  groove: Groove,
  recipe: Recipe,
  barIndex: number,
  step: number,
  mutes: ChairMutes,
): Hit[] {
  const ch = chordAt(groove, barIndex);
  const tones = ch.guitar;
  const low = tones[0] ?? 45;
  const fifth = tones[1] ?? low + 7;
  const midNotes = tones.slice(1, 3);
  const high = tones[tones.length - 1] ?? 64;
  const lowOn = !mutes.low && chairOn(recipe, barIndex, "low");
  const midOn = !mutes.mid && chairOn(recipe, barIndex, "mid");
  const highOn = !mutes.high && chairOn(recipe, barIndex, "high");
  if (!lowOn && !midOn && !highOn) return [];

  const hits: Hit[] = [];
  const feel = recipe.feel;
  const isFillBar = barIndex === 3;

  function strum(gain: number, short = false, offset = 0) {
    if (lowOn) hits.push({ voice: "steel", midi: low, gain: gain * 0.9, offset, dur: short ? 0.16 : 1.4 });
    if (midOn) {
      midNotes.forEach((midi, i) => {
        hits.push({
          voice: "steel",
          midi,
          gain: gain * (0.7 - i * 0.08),
          offset: offset + i * 0.008,
          dur: short ? 0.14 : 1.2,
        });
      });
    }
    if (highOn) {
      hits.push({
        voice: "steel",
        midi: high,
        gain: gain * 0.55,
        offset: offset + 0.016,
        dur: short ? 0.12 : 1.1,
      });
    }
  }

  if (feel === "boom-chick") {
    if ((step === 0 || step === 8) && lowOn) {
      hits.push({ voice: "steel", midi: step === 8 ? fifth : low, gain: 0.34, dur: 0.7 });
    }
    if (step === 4 || step === 12) strum(0.22, true);
  }

  if (feel === "open-strum") {
    if (step % 2 === 0) strum(step % 4 === 0 ? 0.26 : 0.16, false);
    if (step % 4 === 3) strum(0.1, true, 0);
  }

  if (feel === "travis") {
    if ((step === 0 || step === 8) && lowOn) {
      hits.push({ voice: "steel", midi: low, gain: 0.32, dur: 0.55 });
    }
    if ((step === 4 || step === 12) && lowOn) {
      hits.push({ voice: "steel", midi: fifth, gain: 0.26, dur: 0.5 });
    }
    if ((step === 2 || step === 10) && highOn) {
      hits.push({ voice: "steel", midi: high, gain: 0.2, dur: 0.35 });
    }
    if ((step === 6 || step === 14) && midOn) {
      hits.push({ voice: "steel", midi: midNotes[0] ?? fifth, gain: 0.16, dur: 0.3 });
    }
  }

  if (feel === "folk-8ths" && step % 2 === 0) {
    strum(step % 4 === 0 ? 0.24 : 0.14, false);
  }

  if (feel === "chuck") {
    if (step === 0) strum(0.28, false);
    if (step === 4 || step === 12) strum(0.18, true);
  }

  if (feel === "hammer") {
    if (step === 0) strum(0.26, false);
    if (step === 6 && highOn) {
      hits.push({ voice: "steel", midi: high + 3, gain: 0.2, dur: 0.55 });
    }
    if (step === 8 && lowOn) {
      hits.push({ voice: "steel", midi: fifth, gain: 0.18, dur: 0.4 });
    }
  }

  if (feel === "last-fill") {
    if (!isFillBar) {
      if ((step === 0 || step === 8) && lowOn) {
        hits.push({ voice: "steel", midi: step === 8 ? fifth : low, gain: 0.3, dur: 0.65 });
      }
      if (step === 4 || step === 12) strum(0.2, true);
    } else {
      const run = [low, fifth, midNotes[0] ?? fifth, high, high + 2, high + 4].filter(Boolean);
      if (step % 2 === 0) {
        const idx = Math.min(run.length - 1, step / 2);
        const midi = run[idx] ?? high;
        const chair = idx < 2 ? "low" : idx < 4 ? "mid" : "high";
        if ((chair === "low" && lowOn) || (chair === "mid" && midOn) || (chair === "high" && highOn)) {
          hits.push({ voice: "steel", midi, gain: 0.18 + idx * 0.02, dur: 0.22 });
        }
      }
    }
  }

  if (feel === "camp" && step === 0) {
    strum(0.3, false);
  }

  return hits;
}

function collectHits(
  groove: Groove,
  recipe: Recipe,
  barIndex: number,
  step: number,
  mode: PlayMode,
  mutes: ChairMutes,
): Hit[] {
  const hits: Hit[] = [];
  if (mode === "dry" || mode === "steel") hits.push(...dryHits(groove, barIndex, step));
  if (mode === "steel" || mode === "solo") hits.push(...steelLayer(groove, recipe, barIndex, step, mutes));
  return hits;
}

export function collectSteelMidi(groove: Groove, recipe: Recipe, mutes: ChairMutes): Hit[] {
  const events: Hit[] = [];
  const stepDur = 60 / groove.bpm / 4;
  for (let bar = 0; bar < TOTAL_BARS; bar += 1) {
    for (let step = 0; step < STEPS; step += 1) {
      const t = (bar * STEPS + step) * stepDur;
      for (const hit of steelLayer(groove, recipe, bar, step, mutes)) {
        events.push({ ...hit, offset: t + (hit.offset ?? 0) });
      }
    }
  }
  return events;
}

async function decodeInto(
  ctx: BaseAudioContext,
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, AudioBuffer>> {
  const buffers: Record<string, AudioBuffer> = {};
  let done = 0;
  await Promise.all(
    FILES.map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        const raw = await res.arrayBuffer();
        buffers[key] = await ctx.decodeAudioData(raw.slice(0));
      } catch (err) {
        console.warn("sample miss", key, err);
      }
      done += 1;
      onProgress?.(done, FILES.length);
    }),
  );
  return buffers;
}

function playVoice(
  ctx: BaseAudioContext,
  dest: AudioNode,
  buffers: Record<string, AudioBuffer>,
  hit: Hit,
  when: number,
  onHit?: (midi: number) => void,
) {
  let sample: string = hit.voice;
  let rate = hit.rate ?? 1;
  if (hit.voice === "piano" && hit.midi != null) {
    const [n, base] = pickPiano(hit.midi);
    sample = n;
    rate = rateFromMidi(hit.midi, base);
  } else if (hit.voice === "bass" && hit.midi != null) {
    const [n, base] = pickBass(hit.midi);
    sample = n;
    rate = rateFromMidi(hit.midi, base);
  } else if (hit.voice === "steel" && hit.midi != null) {
    const [n, base] = pickSteel(hit.midi);
    sample = n;
    rate = rateFromMidi(hit.midi, base);
    if (onHit) {
      const delay = Math.max(0, (when - ctx.currentTime) * 1000);
      const midi = hit.midi;
      setTimeout(() => onHit(midi), delay);
    }
  }
  const buf = buffers[sample];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.max(0.5, Math.min(2.2, rate));
  const g = ctx.createGain();
  const dur = hit.dur ?? Math.min(2.4, buf.duration / rate);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, hit.gain), when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(g);
  g.connect(dest);
  src.start(when);
  try {
    src.stop(when + dur + 0.05);
  } catch {
    /* already stopped */
  }
}

function scheduleBar(
  ctx: BaseAudioContext,
  dest: AudioNode,
  steelDest: AudioNode,
  buffers: Record<string, AudioBuffer>,
  groove: Groove,
  recipe: Recipe,
  barIndex: number,
  t0: number,
  stepDur: number,
  mode: PlayMode,
  mutes: ChairMutes,
  onHit?: (midi: number) => void,
) {
  for (let step = 0; step < STEPS; step += 1) {
    const jitter = (Math.random() - 0.5) * 0.005;
    const when = t0 + step * stepDur + jitter;
    const hits = collectHits(groove, recipe, barIndex, step, mode, mutes);
    for (const hit of hits) {
      const node = hit.voice === "steel" ? steelDest : dest;
      playVoice(ctx, node, buffers, hit, when + (hit.offset ?? 0), onHit);
    }
  }
}

export type EngineListener = {
  onBar?: (bar: number | null) => void;
  onPlaying?: (playing: boolean, mode: PlayMode | null) => void;
  onStatus?: (status: string) => void;
  onHit?: (midi: number) => void;
};

const OPEN_MUTES: ChairMutes = { low: false, mid: false, high: false };

export function createEngine() {
  let ctx: AudioContext | null = null;
  let bus: GainNode | null = null;
  let steelBus: GainNode | null = null;
  let buffers: Record<string, AudioBuffer> = {};
  let loaded = false;
  let loading: Promise<void> | null = null;
  let playing = false;
  let mode: PlayMode | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let mutes: ChairMutes = { ...OPEN_MUTES };
  const listeners = new Set<EngineListener>();

  function emit() {
    for (const l of listeners) l.onPlaying?.(playing, mode);
  }

  function setStatus(status: string) {
    for (const l of listeners) l.onStatus?.(status);
  }

  function setBar(bar: number | null) {
    for (const l of listeners) l.onBar?.(bar);
  }

  function fireHit(midi: number) {
    for (const l of listeners) l.onHit?.(midi);
  }

  async function ensure() {
    if (loaded) return;
    if (loading) return loading;
    loading = (async () => {
      ctx = new AudioContext();
      bus = ctx.createGain();
      bus.gain.value = 0.44;
      steelBus = ctx.createGain();
      steelBus.gain.value = 1;
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.072;
      const fb = ctx.createGain();
      fb.gain.value = 0.12;
      const wet = ctx.createGain();
      wet.gain.value = 0.16;
      steelBus.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(bus);
      steelBus.connect(bus);
      bus.connect(ctx.destination);
      setStatus("Seating the steel");
      buffers = await decodeInto(ctx, (done, total) => {
        setStatus(`Seating chairs ${done}/${total}`);
      });
      loaded = true;
      setStatus("Steel seated · live FluidR3");
    })();
    try {
      await loading;
    } finally {
      loading = null;
    }
  }

  function halt() {
    playing = false;
    mode = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    setBar(null);
    emit();
  }

  async function play(next: PlayMode, groove: Groove, recipe: Recipe) {
    await ensure();
    if (!ctx || !bus || !steelBus) return;
    if (ctx.state === "suspended") await ctx.resume();
    halt();
    playing = true;
    mode = next;
    emit();
    const stepDur = 60 / groove.bpm / 4;
    let barIndex = 0;
    const loops = next === "steel" ? false : true;
    const tick = () => {
      if (!playing || !ctx || !bus || !steelBus) return;
      if (barIndex >= TOTAL_BARS) {
        if (!loops) {
          halt();
          setStatus("Bed planted · next section on 5");
          return;
        }
        barIndex = 0;
      }
      setBar(barIndex);
      scheduleBar(
        ctx,
        bus,
        steelBus,
        buffers,
        groove,
        recipe,
        barIndex,
        ctx.currentTime + 0.03,
        stepDur,
        next,
        mutes,
        fireHit,
      );
      barIndex += 1;
      timer = setTimeout(tick, STEPS * stepDur * 1000);
    };
    tick();
  }

  async function bounceSteel(groove: Groove, recipe: Recipe): Promise<Blob> {
    await ensure();
    const stepDur = 60 / groove.bpm / 4;
    const seconds = TOTAL_BARS * STEPS * stepDur + 2.4;
    const offline = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
    const pack = await decodeInto(offline);
    const master = offline.createGain();
    master.gain.value = 0.5;
    master.connect(offline.destination);
    for (let i = 0; i < TOTAL_BARS; i += 1) {
      const t0 = i * STEPS * stepDur + 0.02;
      scheduleBar(offline, master, master, pack, groove, recipe, i, t0, stepDur, "solo", mutes);
    }
    const rendered = await offline.startRendering();
    return encodeWav(rendered);
  }

  return {
    subscribe(listener: EngineListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    preload: ensure,
    play,
    stop: halt,
    bounceSteel,
    setMutes(next: ChairMutes) {
      mutes = { ...next };
    },
  };
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = 2;
  const rate = buffer.sampleRate;
  const length = buffer.length;
  const bytes = new ArrayBuffer(44 + length * channels * 2);
  const view = new DataView(bytes);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + length * channels * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, length * channels * 2, true);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    const sl = Math.max(-1, Math.min(1, left[i] ?? 0));
    const sr = Math.max(-1, Math.min(1, right[i] ?? 0));
    view.setInt16(offset, sl < 0 ? sl * 0x8000 : sl * 0x7fff, true);
    view.setInt16(offset + 2, sr < 0 ? sr * 0x8000 : sr * 0x7fff, true);
    offset += 4;
  }
  return new Blob([bytes], { type: "audio/wav" });
}
