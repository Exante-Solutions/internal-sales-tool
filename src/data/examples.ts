/**
 * Seeded example transcripts (Feature 2, SPEC §20) — the reliable on-ramp. The
 * raw text lives in src/data/examples/*.txt (single source of truth, also read
 * by the F2-1 fixture test); this server module catalogs them and reads them at
 * request time. Replaceable: drop in your own .txt and add a row here.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CallType } from "@/domain/rubric";

export interface ExampleTranscript {
  id: string;
  file: string;
  label: string;
  callType: CallType;
  prospect: string;
  contact: string;
  contactRole: string;
}

export const EXAMPLES: ExampleTranscript[] = [
  {
    id: "ex-acme-discovery",
    file: "acme-logistics-discovery.txt",
    label: "Acme Logistics — Discovery",
    callType: "discovery",
    prospect: "Acme Logistics",
    contact: "Priya Shah",
    contactRole: "Director of Ops",
  },
  {
    id: "ex-meridian-demo",
    file: "meridian-health-demo.txt",
    label: "Meridian Health — Demo",
    callType: "demo",
    prospect: "Meridian Health",
    contact: "Marcus Webb",
    contactRole: "VP Claims",
  },
];

const DIR = join(process.cwd(), "src", "data", "examples");

export function exampleById(id: string): ExampleTranscript | undefined {
  return EXAMPLES.find((e) => e.id === id);
}

export function exampleRaw(file: string): string {
  return readFileSync(join(DIR, file), "utf8");
}
