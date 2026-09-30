/**
 * Synthesized inflate sounds for the bubble sheet's fill-in animation.
 *
 * Everything is generated with the Web Audio API from a short white-noise
 * buffer, so there are no audio assets to serve. Three voices are available;
 * change INFLATE_VOICE to switch:
 *
 * - "puff":    a tiny, soft breath of air (default)
 * - "click":   a very short, soft high tick
 * - "scratch": a small gritty brush of noise
 *
 * The sequence is scheduled on the audio clock (not timers), so it stays in
 * step with the CSS animation. Voices are thinned to at most one per
 * MIN_SPACING_MS so large sheets don't turn into a solid hiss.
 */

export type InflateVoice = "puff" | "click" | "scratch"

export const INFLATE_VOICE: InflateVoice = "puff"

/** Overall level relative to full scale. Deliberately very quiet. */
const MASTER_VOLUME = 0.07
/** Minimum gap between two voices in the sequence. */
const MIN_SPACING_MS = 60

export interface InflateSequence {
  /** Number of bubbles in the sheet. */
  count: number
  /** Delay between consecutive bubbles, matching the CSS animation-delay step. */
  stepMs: number
  /** Offset from a bubble's animation start to where its sound should land. */
  leadMs: number
}

export interface InflateSequenceHandle {
  stop: () => void
}

// ---------------------------------------------------------------------------
// Voice synthesis (works with AudioContext and OfflineAudioContext)
// ---------------------------------------------------------------------------

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseCache.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * 0.25),
      ctx.sampleRate
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buffer)
  }
  return buffer
}

/**
 * Schedule one voice at `when` (audio-clock seconds).
 */
export function scheduleVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  voice: InflateVoice,
  when: number
): AudioBufferSourceNode {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  // Start somewhere random in the noise so consecutive voices differ.
  const offset = Math.random() * 0.15
  const jitter = 0.9 + Math.random() * 0.2
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, when)

  let duration: number

  if (voice === "click") {
    const hp = ctx.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = 2600 * jitter
    source.connect(hp).connect(env)
    env.gain.linearRampToValueAtTime(0.55 * jitter, when + 0.0015)
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.014)
    duration = 0.02
  } else if (voice === "scratch") {
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = 3200 * jitter
    bp.Q.value = 1.6
    source.connect(bp).connect(env)
    // A couple of small amplitude bumps give it grit.
    env.gain.linearRampToValueAtTime(0.5 * jitter, when + 0.004)
    env.gain.linearRampToValueAtTime(0.22, when + 0.011)
    env.gain.linearRampToValueAtTime(0.4 * jitter, when + 0.016)
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.038)
    duration = 0.045
  } else {
    // One gentle band of noise with a quick swell and fade. No sweep, no
    // layering: just a hint of air.
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = 1200 * (0.95 + Math.random() * 0.1)
    bp.Q.value = 0.8
    source.connect(bp).connect(env)
    env.gain.linearRampToValueAtTime(0.5, when + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.04)
    duration = 0.045
  }

  env.connect(destination)
  source.start(when, offset, duration)
  return source
}

/**
 * Schedule a whole sheet's worth of voices starting at `startAt` on the given
 * context. Returns the scheduled sources so callers can stop them.
 */
export function scheduleSequence(
  ctx: BaseAudioContext,
  destination: AudioNode,
  sequence: InflateSequence,
  startAt: number,
  voice: InflateVoice = INFLATE_VOICE,
  skipBeforeMs = 0
): AudioBufferSourceNode[] {
  const master = ctx.createGain()
  master.gain.value = MASTER_VOLUME
  master.connect(destination)

  const sources: AudioBufferSourceNode[] = []
  let last = -Infinity
  for (let i = 0; i < sequence.count; i++) {
    const bubbleMs = i * sequence.stepMs
    const atMs = bubbleMs + sequence.leadMs
    if (atMs < skipBeforeMs) continue
    if (atMs - last < MIN_SPACING_MS) continue
    last = atMs
    sources.push(
      scheduleVoice(ctx, master, voice, startAt + (atMs - skipBeforeMs) / 1000)
    )
  }
  return sources
}

// ---------------------------------------------------------------------------
// Live playback
// ---------------------------------------------------------------------------

let liveContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (liveContext) return liveContext
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  liveContext = new Ctor()
  // Browsers keep audio suspended until the user interacts with the frame.
  // Unlock on the first interaction so later sheets (e.g. "New Bubble Wrap")
  // are audible even if the very first fill was not.
  const unlock = () => {
    void liveContext?.resume()
    window.removeEventListener("pointerdown", unlock, true)
    window.removeEventListener("keydown", unlock, true)
  }
  window.addEventListener("pointerdown", unlock, true)
  window.addEventListener("keydown", unlock, true)
  return liveContext
}

/**
 * Play the inflate sequence in step with the animation that starts now.
 * If audio is still locked by the browser's autoplay policy the sequence is
 * dropped rather than queued, so it can never play late in a burst.
 */
export function playInflateSequence(
  sequence: InflateSequence
): InflateSequenceHandle {
  const ctx = getContext()
  if (!ctx || sequence.count <= 0) return { stop() {} }

  const startedAt = performance.now()
  let sources: AudioBufferSourceNode[] = []
  let stopped = false

  const schedule = () => {
    if (stopped || ctx.state !== "running") return
    const elapsed = performance.now() - startedAt
    sources = scheduleSequence(
      ctx,
      ctx.destination,
      sequence,
      ctx.currentTime + 0.01,
      INFLATE_VOICE,
      elapsed
    )
  }

  if (ctx.state === "running") {
    schedule()
  } else {
    // resume() only succeeds if the frame already has user activation.
    const timeout = new Promise((resolve) => setTimeout(resolve, 120))
    void Promise.race([ctx.resume(), timeout]).then(schedule, () => {})
  }

  return {
    stop() {
      stopped = true
      for (const s of sources) {
        try {
          s.stop()
        } catch {
          // already finished
        }
      }
      sources = []
    },
  }
}
