// Every verb is best effort: it answers with whatever the data supports and
// says in the envelope what it could not decide. This is for the case where
// that is nothing at all.

/**
 * Thrown when the resolved colregs data cannot support an answer — the table
 * a verb reads is absent, not merely thin. Never a hedge against incomplete
 * data: an answer that risks being wrong beats no answer.
 */
export class NotImplementedError extends Error {
  /** The verb that could not be evaluated. */
  readonly verb: string;
  /** The data table or section that is missing, and where that gap is tracked. */
  readonly missing: string;

  constructor(verb: string, missing: string) {
    super(`${verb} could not be evaluated: ${missing} is missing from the resolved colregs data`);
    this.name = 'NotImplementedError';
    this.verb = verb;
    this.missing = missing;
  }
}

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
