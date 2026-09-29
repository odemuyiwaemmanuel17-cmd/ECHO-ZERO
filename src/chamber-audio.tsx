import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { audio } from "./audio";
import type { Run } from "./game";

/** Spatial ventilation, including short room reflections. Shares the existing volume/pause bus. */
export function ChamberAudio({ run }: { run: Run }) {
  const nodes = useRef<{ source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; filter: BiquadFilterNode; room: ConvolverNode; wet: GainNode } | null>(null);
  useFrame(() => {
    const ctx = audio.context;
    if (!ctx || !audio.master) return;
    if (!nodes.current) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let previous = 0, seed = 81;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        previous = previous * .94 + (seed / 4294967296 - .5) * .06;
        data[i] = previous + Math.sin(i / ctx.sampleRate * Math.PI * 2 * 83) * .025;
      }
      const source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner(), filter = ctx.createBiquadFilter();
      source.buffer = buffer; source.loop = true; gain.gain.value = 0;
      filter.type = "lowpass"; filter.frequency.value = 1200;
      const room = ctx.createConvolver(), wet = ctx.createGain();
      const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * .65), ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const out = impulse.getChannelData(channel);
        for (let i = 0; i < out.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          out[i] = (seed / 4294967296 - .5) * Math.exp(-i / ctx.sampleRate * 13) * .015;
        }
        for (const t of [.023, .047, .081]) out[Math.floor((t + channel * .002) * ctx.sampleRate)] += .15;
      }
      room.buffer = impulse; wet.gain.value = .14;
      source.connect(filter).connect(gain).connect(pan).connect(audio.master);
      gain.connect(room).connect(wet).connect(audio.master); source.start();
      nodes.current = { source, gain, pan, filter, room, wet };
    }
    const distance = Math.hypot(run.x - 4.69, run.z + 3.6);
    nodes.current.gain.gain.setTargetAtTime(audio.active ? .5 / (1 + distance * .4) : 0, ctx.currentTime, .2);
    const bearing = Math.atan2(4.69 - run.x, -3.6 - run.z);
    nodes.current.pan.pan.setTargetAtTime(Math.sin(bearing + audio.listenerYaw), ctx.currentTime, .12);
  });
  useEffect(() => () => {
    const n = nodes.current;
    if (n) { n.source.stop(); Object.values(n).forEach(node => node.disconnect()); nodes.current = null; }
  }, []);
  return null;
}
