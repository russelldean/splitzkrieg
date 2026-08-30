/** Types for data-integrity-report.mjs. */

export interface ReportInput {
  findings?: { message: string }[];
  error?: string;
  checked?: number;
  ranAt?: string;
}

export declare function shouldAlert(input: ReportInput): boolean;
export declare function subjectFor(input: ReportInput): string;
export declare function bodyFor(input: ReportInput): string;
