/** Types for data-invariants.mjs, which is plain ESM so the CLI can import it too. */

export interface Invariant {
  /** Stable identifier, unique across the set. */
  name: string;
  /** Why a violation matters, carried into the alert. */
  why: string;
  /** Query returning a single count column `n`. */
  sql: string;
  /** Expected count. Defaults to 0. */
  expect?: number;
}

export interface Finding {
  name: string;
  expected: number;
  actual: number;
  why: string;
  message: string;
}

export declare const INVARIANTS: Invariant[];
export declare function evaluate(invariant: Invariant, count: number): Finding | null;
export declare function evaluateAll(
  results: { invariant: Invariant; count: number }[],
): Finding[];
