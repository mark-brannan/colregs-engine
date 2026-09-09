// The one error a named-but-unbuilt verb throws.
//
// ADR 0002 ships every verb as a stub from the day it is named, so the
// envelopes are compiler-checked rather than read as prose. A stub throws
// rather than returning a value: an envelope of empty arrays and a default
// status is indistinguishable from a computed one, and a caller has no way
// to tell them apart. A throw is unmissable.

/**
 * Thrown by an exported verb whose shape is fixed but whose body is not
 * built. Carries the verb's name and the ADR section that fixes its shape.
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
