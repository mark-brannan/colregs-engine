// The one error a verb throws about the caller's data rather than its shape:
// a validation failure names the offending key in a plain Error; this one
// names two versions that disagree.

/**
 * Thrown when caller-supplied `data` (ADR 0009's `data/version.json` stamp,
 * passed as `EvaluateOptions.dataVersion`) does not match the colregs
 * release this package resolves. Without this check, `Evaluation.colregs`
 * stamps the result with the resolved npm dependency's version regardless
 * of what `data` actually was — a caller handing over stale or hand-built
 * applicability data gets a result silently attributed to the wrong
 * release (colregs issue tracked in colregs-engine#77).
 */
export class DataVersionMismatchError extends Error {
  /** The version this package's resolved colregs dependency reports. */
  readonly resolvedVersion: string;
  /** The version the caller's `data` was stamped with. */
  readonly dataVersion: string;

  constructor(resolvedVersion: string, dataVersion: string) {
    super(
      `caller-supplied data is stamped colregs ${dataVersion}, but this package resolves colregs ${resolvedVersion}; ` +
        'pass matching data, or omit dataVersion to skip the check',
    );
    this.name = 'DataVersionMismatchError';
    this.resolvedVersion = resolvedVersion;
    this.dataVersion = dataVersion;
  }
}
