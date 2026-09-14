// Every verb is best effort: it answers with whatever the data supports and
// says in the envelope what it could not decide. This is for the case where
// that is nothing at all.

/**
 * Thrown when the resolved colregs data cannot support an answer — the table
 * a verb reads is absent, not merely thin. Never a hedge against incomplete
 * data: an answer that risks being wrong beats no answer.
 */
export class NotImplementedError extends Error {
  /** The verb that is not built. */
  readonly verb: string;
  /** The ADR section that fixes its signature and result shape. */
  readonly shapeFixedBy: string;

  constructor(verb: string, shapeFixedBy: string) {
    super(`${verb} is not built: ${shapeFixedBy} fixes its shape, not its body`);
    this.name = 'NotImplementedError';
    this.verb = verb;
    this.shapeFixedBy = shapeFixedBy;
  }
}
