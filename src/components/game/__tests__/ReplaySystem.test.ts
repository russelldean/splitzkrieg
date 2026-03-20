import { describe, it, expect } from 'vitest';
import { ReplaySystem } from '../ReplaySystem';
import type { ReplayFrame } from '../types';

function makeFrame(timestamp: number): ReplayFrame {
  return {
    ballPos: { x: 100, y: 400 - timestamp },
    ballAngle: 0,
    pinPos: { x: 100, y: 60 },
    pinAngle: 0,
    timestamp,
  };
}

describe('ReplaySystem', () => {
  it('records frames during active recording', () => {
    const replay = new ReplaySystem();
    replay.startRecording();
    for (let i = 0; i < 5; i++) {
      replay.captureFrame(makeFrame(i * 16));
    }
    expect(replay.getFrameCount()).toBe(5);
    expect(replay.getFrames()).toHaveLength(5);
  });

  it('ignores frames after stopRecording', () => {
    const replay = new ReplaySystem();
    replay.startRecording();
    replay.captureFrame(makeFrame(0));
    replay.captureFrame(makeFrame(16));
    replay.stopRecording();
    replay.captureFrame(makeFrame(32));
    replay.captureFrame(makeFrame(48));
    expect(replay.getFrameCount()).toBe(2);
  });

  it('calculates replay duration at 0.25x speed (4x longer)', () => {
    const replay = new ReplaySystem();
    replay.startRecording();
    // Record 60 frames spanning 1000ms
    for (let i = 0; i <= 60; i++) {
      replay.captureFrame(makeFrame(i * (1000 / 60)));
    }
    replay.stopRecording();

    const duration = replay.getReplayDuration(0.25);
    // 1000ms original / 0.25 speed = 4000ms
    expect(duration).toBeCloseTo(4000, 0);
  });

  it('caps frames at maxFrames (300)', () => {
    const replay = new ReplaySystem();
    replay.startRecording();
    for (let i = 0; i < 400; i++) {
      replay.captureFrame(makeFrame(i * 16));
    }
    expect(replay.getFrameCount()).toBe(300);
  });

  it('returns 0 duration for fewer than 2 frames', () => {
    const replay = new ReplaySystem();
    replay.startRecording();
    expect(replay.getReplayDuration()).toBe(0);
    replay.captureFrame(makeFrame(0));
    expect(replay.getReplayDuration()).toBe(0);
  });

  it('resets clears all frames and stops recording', () => {
    const replay = new ReplaySystem();
    replay.startRecording();
    replay.captureFrame(makeFrame(0));
    replay.captureFrame(makeFrame(16));
    replay.reset();
    expect(replay.getFrameCount()).toBe(0);
    // After reset, captureFrame should not record (not recording)
    replay.captureFrame(makeFrame(32));
    expect(replay.getFrameCount()).toBe(0);
  });
});
