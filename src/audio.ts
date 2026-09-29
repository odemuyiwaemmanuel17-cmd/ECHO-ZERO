/** Small synthesized soundscape. Created only from a user gesture, no downloads. */
class FacilityAudio {
  context?: AudioContext;
  master?: GainNode;
  ambience?: GainNode;
  volume = 0.45;
  bus?: AudioNode;
  oscillators: OscillatorNode[] = [];
  filter?: BiquadFilterNode;
  currentRoom = -1;
  quiet = false;
  listenerYaw = Math.PI;
  active = false;
  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.ambience = this.context.createGain();
      this.ambience.gain.value = 0;
      this.ambience.connect(this.master);
      for (const frequency of [48, 96, 151]) {
        const oscillator = this.context.createOscillator();
        oscillator.frequency.value = frequency;
        const gain = this.context.createGain();
        gain.gain.value = 0.022;
        oscillator.connect(gain).connect(this.ambience);
        oscillator.start();
        this.oscillators.push(oscillator);
      }
      const noise = this.context.createBuffer(
        1,
        this.context.sampleRate * 3,
        this.context.sampleRate,
      );
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = (Math.random() * 2 - 1) * 0.09;
      const source = this.context.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = this.context.createBiquadFilter();
      this.filter = filter;
      filter.type = "lowpass";
      filter.frequency.value = 350;
      source.connect(filter).connect(this.ambience);
      source.start();
    }
    await this.context.resume();
  }
  setVolume(value: number) {
    this.volume = value;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
  }
  setActive(active: boolean, power = false) {
    this.active = active;
    if (this.context && this.ambience)
      this.ambience.gain.setTargetAtTime(
        active ? (power ? 0.7 : 0.4) : 0,
        this.context.currentTime,
        0.3,
      );
  }
  room(index: number, quiet: boolean) {
    if (
      !this.context ||
      !this.ambience ||
      (index === this.currentRoom && quiet === this.quiet)
    )
      return;
    this.currentRoom = index;
    this.quiet = quiet;
    const base = [48, 61, 43, 37, 32, 73, 86, 55][index];
    this.oscillators.forEach((o, i) =>
      o.frequency.setTargetAtTime(base * (i + 1), this.context!.currentTime, 2),
    );
    this.filter?.frequency.setTargetAtTime(
      index === 6 ? 1300 : index === 4 ? 250 : 450,
      this.context.currentTime,
      2,
    );
    this.ambience.gain.setTargetAtTime(
      this.active ? (quiet ? 0.04 : index === 4 ? 0.8 : 0.35) : 0,
      this.context.currentTime,
      0.7,
    );
  }
  cueAt(
    name: Parameters<FacilityAudio["cue"]>[0],
    x: number,
    z: number,
    px: number,
    pz: number,
  ) {
    if (!this.context || !this.master || !this.active) return;
    const distance = Math.hypot(x - px, z - pz);
    if (distance > 22) return;
    const gain = this.context.createGain(),
      pan = this.context.createStereoPanner();
    gain.gain.value = 1 / (1 + distance * 0.18);
    pan.pan.value = Math.max(
      -0.9,
      Math.min(
        0.9,
        ((x - px) * Math.cos(this.listenerYaw) -
          (z - pz) * Math.sin(this.listenerYaw)) /
          Math.max(3, distance),
      ),
    );
    gain.connect(pan).connect(this.master);
    this.bus = gain;
    this.cue(name);
    this.bus = undefined;
    setTimeout(() => {
      gain.disconnect();
      pan.disconnect();
    }, 4000);
  }
  tone(
    frequency: number,
    duration: number,
    volume = 0.08,
    type: OscillatorType = "sine",
    end = frequency,
  ) {
    if (!this.context || !this.master || !this.active) return;
    const now = this.context.currentTime,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, end), now + duration);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    o.connect(g).connect(this.bus ?? this.master);
    o.start();
    o.stop(now + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  noise(duration: number, volume = 0.06, frequency = 1300) {
    if (!this.context || !this.master || !this.active) return;
    const context = this.context,
      now = context.currentTime,
      buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      );
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    gain.gain.value = volume;
    source
      .connect(filter)
      .connect(gain)
      .connect(this.bus ?? this.master);
    source.start(now);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  cue(
    name:
      | "door"
      | "pickup"
      | "power"
      | "radio"
      | "shot"
      | "baton"
      | "emp"
      | "damage"
      | "step"
      | "concrete"
      | "grating"
      | "wet"
      | "breath"
      | "metal"
      | "steam"
      | "impact"
      | "glass",
  ) {
    if (name === "door") {
      this.tone(80, 0.6, 0.06, "sawtooth", 42);
      this.noise(0.3, 0.03, 450);
    }
    if (name === "pickup") {
      this.tone(620, 0.12, 0.05, "sine", 1100);
    }
    if (name === "power") {
      this.tone(42, 3, 0.15, "sawtooth", 180);
      this.noise(1.6, 0.1, 650);
    }
    if (name === "radio") {
      this.noise(0.2, 0.025, 2500);
      this.tone(830, 0.12, 0.025);
    }
    if (name === "shot") {
      this.tone(1800, 0.2, 0.09, "sawtooth", 110);
      this.noise(0.12, 0.08, 1800);
    }
    if (name === "baton") {
      this.noise(0.22, 0.12, 900);
      this.tone(150, 0.1, 0.08, "square", 50);
    }
    if (name === "emp") {
      this.tone(180, 1, 0.1, "sine", 2200);
      this.noise(0.5, 0.09, 3500);
    }
    if (name === "damage") {
      this.tone(70, 0.3, 0.12, "triangle", 28);
      this.noise(0.15, 0.06, 900);
    }
    if (name === "step") {
      this.noise(0.1, 0.025, 250);
      this.tone(75, 0.08, 0.024, "triangle", 40);
    }
    if (name === "concrete") {
      this.noise(0.08, 0.023, 450);
      this.tone(58, 0.07, 0.018, "triangle", 35);
    }
    if (name === "grating") {
      this.noise(0.09, 0.018, 1700);
      this.tone(210, 0.12, 0.012, "triangle", 110);
    }
    if (name === "wet") {
      this.noise(0.14, 0.03, 900);
      this.tone(65, 0.07, 0.015, "sine", 40);
    }
    if (name === "breath") this.noise(1.2, 0.018, 650);
    if (name === "metal") {
      this.tone(92, 0.6, 0.08, "triangle", 60);
      this.tone(237, 0.3, 0.025);
    }
    if (name === "steam") this.noise(1.4, 0.1, 3200);
    if (name === "impact") {
      this.noise(0.11, 0.13, 4800);
      this.tone(370, 0.16, 0.08, "triangle", 110);
    }
    if (name === "glass") {
      this.noise(0.22, 0.08, 7000);
      this.tone(1600, 0.12, 0.03, "sine", 2800);
    }
  }
}
export const audio = new FacilityAudio();
