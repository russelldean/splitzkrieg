import type { ReplayFrame } from './types';

/**
 * ReplaySystem records game frames during rolling/cheat phases
 * and provides them for slow-motion playback after cheats.
 */
export class ReplaySystem {
  private frames: ReplayFrame[] = [];
  private isRecording = false;
  private maxFrames = 300; // ~5 seconds at 60fps

  startRecording() {
    this.frames = [];
    this.isRecording = true;
  }

  stopRecording() {
    this.isRecording = false;
  }

  captureFrame(frame: ReplayFrame) {
    if (!this.isRecording) return;
    if (this.frames.length < this.maxFrames) {
      this.frames.push(frame);
    }
  }

  getFrames(): ReplayFrame[] {
    return this.frames;
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  /**
   * Returns duration in ms for the replay at given speed.
   * Speed 0.25 = 4x slower than original.
   */
  getReplayDuration(speed: number = 0.25): number {
    if (this.frames.length < 2) return 0;
    const totalTime = this.frames[this.frames.length - 1].timestamp - this.frames[0].timestamp;
    return totalTime / speed;
  }

  reset() {
    this.frames = [];
    this.isRecording = false;
  }
}
