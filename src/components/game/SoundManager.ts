import { Howl } from 'howler';

type SoundName = 'roll' | 'impact' | 'woosh' | 'cheat' | 'fanfare' | 'clatter' | 'release' | 'gutter';

/**
 * SoundManager wraps Howler.js for game audio.
 * Initializes on first user interaction to comply with iOS audio unlock requirements.
 * Falls back to Web Audio placeholder beeps when sprite files are empty/missing.
 */
export class SoundManager {
  private sounds: Howl | null = null;
  private ambient: Howl | null = null;
  private ambientId: number | null = null;
  private initialized = false;
  private usePlaceholder = false;
  private audioCtx: AudioContext | null = null;

  /**
   * Initialize on first user interaction (iOS audio unlock per Pitfall 1).
   * Attempts Howler.js first; falls back to placeholder beeps if sprites fail to load.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      this.sounds = new Howl({
        src: ['/sounds/game-sprites.webm', '/sounds/game-sprites.mp3'],
        sprite: {
          roll:     [0, 2000, true],   // Looping ball roll
          impact:   [2000, 500],        // Ball hits pin
          woosh:    [2500, 400],        // Ball miss / near miss
          cheat:    [2900, 600],        // Generic cheat sound
          fanfare:  [3500, 2100],       // Win celebration
          clatter:  [5600, 800],        // Pin falling
          release:  [6400, 300],        // Ball release snap
          gutter:   [6700, 400],        // Ball drops into gutter
        },
        onloaderror: () => {
          this.sounds = null;
          this.usePlaceholder = true;
        },
      });

      this.ambient = new Howl({
        src: ['/sounds/ambient-loop.webm', '/sounds/ambient-loop.mp3'],
        loop: true,
        volume: 0.4,
        onloaderror: () => {
          this.ambient = null;
        },
      });
    } catch {
      this.usePlaceholder = true;
    }
  }

  startAmbient() {
    if (this.ambient && this.ambientId === null) {
      this.ambientId = this.ambient.play();
    }
  }

  stopAmbient() {
    if (this.ambient && this.ambientId !== null) {
      this.ambient.stop(this.ambientId);
      this.ambientId = null;
    }
  }

  play(sound: SoundName) {
    if (this.sounds) {
      this.sounds.play(sound);
      return;
    }
    if (this.usePlaceholder) {
      this.playPlaceholder(sound);
    }
  }

  stop(_sound?: SoundName) {
    if (this.sounds) {
      this.sounds.stop();
    }
  }

  /**
   * For development: create simple Web Audio beeps as stand-ins
   * for real sound assets. Each sound type gets a distinct frequency/pattern.
   */
  initPlaceholder() {
    this.usePlaceholder = true;
    this.initialized = true;
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioCtx) return this.audioCtx;
    if (typeof AudioContext !== 'undefined') {
      this.audioCtx = new AudioContext();
      return this.audioCtx;
    }
    return null;
  }

  private playPlaceholder(sound: SoundName) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;

    // Different frequencies/durations per sound type
    const config: Record<SoundName, { freq: number; duration: number; type: OscillatorType }> = {
      roll:     { freq: 120, duration: 0.3, type: 'sawtooth' },
      impact:   { freq: 200, duration: 0.15, type: 'square' },
      woosh:    { freq: 400, duration: 0.2, type: 'sine' },
      cheat:    { freq: 300, duration: 0.3, type: 'triangle' },
      fanfare:  { freq: 523, duration: 0.8, type: 'square' },
      clatter:  { freq: 180, duration: 0.25, type: 'sawtooth' },
      release:  { freq: 350, duration: 0.1, type: 'sine' },
      gutter:   { freq: 100, duration: 0.2, type: 'square' },
    };

    const c = config[sound];
    oscillator.type = c.type;
    oscillator.frequency.value = c.freq;
    oscillator.start();
    oscillator.stop(ctx.currentTime + c.duration);
  }
}
