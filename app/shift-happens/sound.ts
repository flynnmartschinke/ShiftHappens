export type Cue = "spawn" | "pick" | "put" | "approve" | "pin" | "rush" | "win" | "lose";

const storageKey = "shift-happens-muted";

// Small synthesised sound effects, so the game needs no audio files.
export function createSound() {
  let context: AudioContext | undefined;
  let muted = false;
  try {
    muted = localStorage.getItem(storageKey) === "1";
  } catch {
    // Storage can be unavailable in private or embedded browsers.
  }

  function unlock() {
    if (!context) {
      try {
        context = new AudioContext();
      } catch {
        return;
      }
    }
    if (context.state === "suspended") void context.resume();
  }

  function note(frequency: number, at: number, length: number, type: OscillatorType, volume: number, slideTo?: number) {
    if (!context) return;
    const start = context.currentTime + at;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
  }

  function thud(volume: number) {
    if (!context) return;
    const length = 0.16;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * length), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }

  const cues: Record<Cue, () => void> = {
    spawn: () => note(880, 0, 0.09, "sine", 0.05, 1320),
    pick: () => note(520, 0, 0.1, "triangle", 0.12, 860),
    put: () => note(420, 0, 0.1, "triangle", 0.1, 260),
    approve: () => {
      thud(0.9);
      note(196, 0, 0.18, "square", 0.05, 110);
      note(784, 0.08, 0.16, "sine", 0.08);
    },
    pin: () => {
      note(988, 0, 0.12, "sine", 0.11);
      note(1319, 0.07, 0.2, "sine", 0.1);
    },
    rush: () => {
      note(330, 0, 0.14, "sawtooth", 0.05, 660);
      note(660, 0.13, 0.18, "sawtooth", 0.05, 990);
    },
    win: () => [523, 659, 784, 1047].forEach((tone, i) => note(tone, i * 0.11, 0.32, "triangle", 0.12)),
    lose: () => [392, 330, 262].forEach((tone, i) => note(tone, i * 0.18, 0.34, "triangle", 0.1)),
  };

  return {
    unlock,
    play(cue: Cue) {
      if (!muted && context?.state === "running") cues[cue]();
    },
    get muted() {
      return muted;
    },
    setMuted(value: boolean) {
      muted = value;
      try {
        localStorage.setItem(storageKey, value ? "1" : "0");
      } catch {
        // Ignore storage failures; the setting still applies for this visit.
      }
    },
  };
}

export type Sound = ReturnType<typeof createSound>;
