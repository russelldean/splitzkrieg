/**
 * HapticManager wraps the Vibration API for game feedback.
 * Degrades gracefully on iOS (no Vibration API support) with a no-op.
 */
export class HapticManager {
  private supported: boolean;

  constructor() {
    this.supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  /** Short buzz on ball release */
  release() {
    if (this.supported) navigator.vibrate(50);
  }

  /** Strong pulse on ball-pin impact */
  impact() {
    if (this.supported) navigator.vibrate([100, 50, 100]);
  }

  /** Quick pattern for cheat moment */
  cheat() {
    if (this.supported) navigator.vibrate([30, 20, 30, 20, 60]);
  }

  /** Long celebration pattern for win */
  win() {
    if (this.supported) navigator.vibrate([200, 100, 200, 100, 400]);
  }
}
