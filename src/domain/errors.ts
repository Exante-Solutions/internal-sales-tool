/** Domain errors — framework-free, translated to HTTP at the route boundary. */

export class ScoringIntegrityError extends Error {
  constructor(public readonly issues: string[]) {
    super(`scorer output failed grader: ${issues.join("; ")}`);
    this.name = "ScoringIntegrityError";
  }
}

export class TranscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptError";
  }
}
