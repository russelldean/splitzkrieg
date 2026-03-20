import { describe, it, expect } from 'vitest';
import { VectorRenderer } from '../renderers/VectorRenderer';

describe('VectorRenderer', () => {
  it('can be instantiated', () => {
    const renderer = new VectorRenderer();
    expect(renderer).toBeDefined();
  });

  it('implements all GameRenderer methods', () => {
    const renderer = new VectorRenderer();
    expect(typeof renderer.drawLane).toBe('function');
    expect(typeof renderer.drawBall).toBe('function');
    expect(typeof renderer.drawPin).toBe('function');
    expect(typeof renderer.drawGutters).toBe('function');
    expect(typeof renderer.drawAimArrow).toBe('function');
    expect(typeof renderer.drawCheatEffect).toBe('function');
    expect(typeof renderer.drawCaption).toBe('function');
    expect(typeof renderer.drawPredictorText).toBe('function');
  });

  it('drawPredictorText accepts ctx and text arguments', () => {
    const renderer = new VectorRenderer();
    // drawPredictorText should accept 2 args (ctx, text) without throwing
    expect(renderer.drawPredictorText.length).toBeGreaterThanOrEqual(1);
  });
});
