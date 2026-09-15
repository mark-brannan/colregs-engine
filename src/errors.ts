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
