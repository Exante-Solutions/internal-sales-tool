/**
 * Stored-call domain types (Feature 2, SPEC §20). A user-owned call = its meta
 * + the atomic Evaluation + the Transcript it cites. Persisted by a CallStore
 * (Neon when DATABASE_URL is set, in-memory otherwise). No SDK/framework imports.
 */

import type { Evaluation, Transcript } from "./coaching";
import type { CallType } from "./rubric";

export interface StoredCallMeta {
  id: string;
  repId: string;
  callType: CallType;
  prospect: string;
  contact: string;
  contactRole: string;
  date: string;
}

export interface StoredCall {
  meta: StoredCallMeta;
  evaluation: Evaluation;
  transcript: Transcript;
}
