/**
 * RegenerateProfile use case (SPEC §4.4, §6.5; RUBRIC I1/I2).
 *
 * Rolls a Person/Company's append-only timeline up into a fresh AI summary. It
 * reads the timeline and writes ONLY the derived ProfileSummary — it NEVER
 * mutates the timeline (the timeline is the source of truth; the summary is
 * derived, I1). The summary records the `sourceEntryCount` it covered so a
 * stale rollup is detectable once the timeline grows past it (I2), using the
 * pure lib/profile/timeline.mjs::summarySource as the single source of truth.
 *
 * The vendor model output dies at the AnalysisGateway adapter; only the domain
 * ProfileSummary crosses here. Imports domain + the pure timeline lib only — no
 * SDK, no framework, no ORM, no validator.
 */

import type { SubjectType, ProfileSummary } from "@/domain/profile";
import type { AnalysisGateway, TimelineRepository } from "@/domain/ports";
import type { IdGenerator, Clock } from "./support";
import { summarySource } from "../../lib/profile/timeline.mjs";

export class RegenerateProfile {
  constructor(
    private readonly timeline: TimelineRepository,
    private readonly analysisGateway: AnalysisGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async regenerate(subjectType: SubjectType, subjectId: string): Promise<ProfileSummary> {
    // Read the append-only timeline (oldest→newest). It is never mutated here.
    const timeline = await this.timeline.list(subjectType, subjectId);

    // AI rollup over the timeline; vendor output dies at the gateway adapter.
    const produced = await this.analysisGateway.summarizeProfile(subjectType, subjectId, timeline);

    // The derived summary records the entry count it covered (I2), pinned to the
    // pure lib so staleness math has a single source of truth.
    const { sourceEntryCount } = summarySource(timeline) as { sourceEntryCount: number };

    const summary: ProfileSummary = {
      id: produced.id ?? this.ids.next(),
      subjectType,
      subjectId,
      summaryMd: produced.summaryMd,
      generatedAt: this.clock.nowIso(),
      sourceEntryCount,
    };

    // Writes ONLY the profile summary — the timeline is left untouched (I1).
    await this.timeline.saveSummary(summary);
    return summary;
  }
}
