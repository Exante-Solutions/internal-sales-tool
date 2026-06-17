/**
 * Composition root — the ONE place concrete adapters are chosen (CLAUDE.md law
 * 6). With ANTHROPIC_API_KEY set, the real Opus 4.8 adapters run; without it,
 * the deterministic fakes keep the whole loop alive offline. Storage chooses
 * Neon when DATABASE_URL is set, else an in-memory store; the session is the
 * seeded team until an Auth0 adapter is wired (Feature 3). Grep an adapter's
 * class name → it appears only in its own file and here.
 */

import { CoachService } from "@/application/coach-service";
import { AnthropicScorer } from "./anthropic-scorer";
import { AnthropicDrillScenario } from "./anthropic-drill-scenario";
import { AnthropicRescorer } from "./anthropic-rescorer";
import { AnthropicCoachBriefing } from "./anthropic-coach-briefing";
import { AnthropicTeamCoach } from "./anthropic-team-coach";
import {
  FakeScorer,
  FakeDrillScenario,
  FakeRescorer,
  FakeCoachBriefing,
  FakeTeamCoach,
} from "./fake-adapters";
import { NeonCallStore } from "./neon-call-store";
import { MemoryCallStore } from "./memory-call-store";
import { SeededSessionGateway } from "./seeded-session";
import { Auth0SessionGateway } from "./auth0-session";
import { authMode as authModeFor } from "@auth-session";
import type {
  CallStore,
  SessionGateway,
  TeamCoachGateway,
  PersonRepository,
  CompanyRepository,
  InitiativeRepository,
  ConversationRepository,
  TimelineRepository,
  FollowUpRepository,
  EmailMessageRepository,
  AnalysisGateway,
  GmailGateway,
  SecretStore,
  AppUserRepository,
  GoogleConnectionRepository,
  IntegrationConfigStore,
} from "@/domain/ports";

// ── Discovery Workspace wiring (SPEC §6, §7.1, §10) ─────────────────────────
import {
  MemoryPersonRepository,
  MemoryCompanyRepository,
  MemoryInitiativeRepository,
  MemoryConversationRepository,
  MemoryTimelineRepository,
  MemoryFollowUpRepository,
  MemoryEmailMessageRepository,
  MemoryAppUserRepository,
  MemoryGoogleConnectionRepository,
  MemoryIntegrationConfigStore,
} from "./db/memory-repositories";
import {
  NeonPersonRepository,
  NeonCompanyRepository,
  NeonInitiativeRepository,
  NeonConversationRepository,
  NeonTimelineRepository,
  NeonFollowUpRepository,
  NeonEmailMessageRepository,
  NeonAppUserRepository,
  NeonGoogleConnectionRepository,
  NeonIntegrationConfigStore,
} from "./db/repositories";
import { FakeAnalysisGateway } from "./fake-analysis";
import { AnthropicAnalysis } from "./anthropic-analysis";
import { FakeCalendarGateway } from "./calendar/fake-calendar";
import { CalendarProviderAdapter } from "./calendar/provider-adapter";
import { FakeGmailAdapter } from "./gmail/fake-gmail";
import { GoogleGmailAdapter } from "./gmail/google-gmail-adapter";
import { FakeSecretStore } from "./secrets/fake-secret-store";
import { AwsSecretsManagerAdapter } from "./secrets/aws-secrets-manager-adapter";
import { ResolveIdentity } from "@/application/resolve-identity";
import { AssociateInitiative } from "@/application/associate-initiative";
import { IngestRecording } from "@/application/ingest-recording";
import { AnalyzeConversation } from "@/application/analyze-conversation";
import { AddParticipant } from "@/application/add-participant";
import { RunPlaybookCheck } from "@/application/run-playbook-check";
import { RegenerateProfile } from "@/application/regenerate-profile";
import { SyncContactEmails } from "@/application/sync-contact-emails";
import type { IdGenerator, Clock } from "@/application/support";

export type ScoringMode = "live" | "seeded";
export type StorageMode = "neon" | "memory";
export type AuthMode = "auth0" | "seeded";

export function scoringMode(): ScoringMode {
  return process.env.ANTHROPIC_API_KEY ? "live" : "seeded";
}

/** Neon when DATABASE_URL is set, else the in-memory fallback (Feature 2). */
export function storageMode(): StorageMode {
  return process.env.DATABASE_URL ? "neon" : "memory";
}

/** "auth0" only when a tenant is configured; "seeded" otherwise — the demo
 * fallback that means a missing login can never break the app (Feature 3). */
export function authMode(): AuthMode {
  return authModeFor(process.env) as AuthMode;
}

export function buildCoachService(mode: ScoringMode = scoringMode()): CoachService {
  if (mode === "live") {
    return new CoachService(
      new AnthropicScorer(),
      new AnthropicDrillScenario(),
      new AnthropicRescorer(),
      new AnthropicCoachBriefing(),
    );
  }
  return new CoachService(
    new FakeScorer(),
    new FakeDrillScenario(),
    new FakeRescorer(),
    new FakeCoachBriefing(),
  );
}

/** Seeded service for views that should never hit the network (progress/team). */
export function seededCoachService(): CoachService {
  return buildCoachService("seeded");
}

export function buildCallStore(): CallStore {
  return storageMode() === "neon" ? new NeonCallStore() : new MemoryCallStore();
}

/** The app_user store, chosen by the same storage signal as the other repos
 * (Neon when DATABASE_URL, else in-memory). Used to provision Auth0 identities. */
function buildAppUserRepository(): AppUserRepository {
  return storageMode() === "neon"
    ? new NeonAppUserRepository()
    : new MemoryAppUserRepository();
}

/** Auth0SessionGateway when a tenant is configured (provisions the app_user into
 * DEFAULT_TEAM_ID and returns its id as userId); else the SeededSessionGateway —
 * the demo fallback that means a missing login can never break the app. The
 * concrete is chosen ONLY here (CLAUDE.md law 6). */
export function buildSession(): SessionGateway {
  return authMode() === "auth0"
    ? new Auth0SessionGateway(buildAppUserRepository())
    : new SeededSessionGateway();
}

export function buildTeamCoach(mode: ScoringMode = scoringMode()): TeamCoachGateway {
  return mode === "live" ? new AnthropicTeamCoach() : new FakeTeamCoach();
}

// ── Discovery Workspace composition (SPEC §6, §7.1, §10) ────────────────────
//
// One getServices() factory assembles every repository, gateway, and use case
// the discovery routes need. Concretes are chosen here and NOWHERE else (CLAUDE
// law 6): Neon repos + live Anthropic/Google/AWS adapters when configured, else
// the in-memory repos + fakes so the whole loop runs offline with no keys/DB.

/** Deterministic-ish id source (crypto.randomUUID), wired only at the root. */
class UuidGenerator implements IdGenerator {
  next(): string {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Wall-clock ISO time source. */
class SystemClock implements Clock {
  nowIso(): string {
    return new Date().toISOString();
  }
}

export interface DiscoveryRepositories {
  people: PersonRepository;
  companies: CompanyRepository;
  initiatives: InitiativeRepository;
  conversations: ConversationRepository;
  timeline: TimelineRepository;
  followUps: FollowUpRepository;
  emails: EmailMessageRepository;
  appUsers: AppUserRepository;
  connections: GoogleConnectionRepository;
}

export interface DiscoveryServices extends DiscoveryRepositories {
  ids: IdGenerator;
  clock: Clock;
  analysisGateway: AnalysisGateway;
  gmail: GmailGateway;
  secrets: SecretStore;
  integrations: IntegrationConfigStore;
  ingestRecording: IngestRecording;
  resolveIdentity: ResolveIdentity;
  associateInitiative: AssociateInitiative;
  analyzeConversation: AnalyzeConversation;
  addParticipant: AddParticipant;
  runPlaybookCheck: RunPlaybookCheck;
  regenerateProfile: RegenerateProfile;
  syncContactEmails: SyncContactEmails;
}

function buildRepositories(): DiscoveryRepositories {
  if (storageMode() === "neon") {
    return {
      people: new NeonPersonRepository(),
      companies: new NeonCompanyRepository(),
      initiatives: new NeonInitiativeRepository(),
      conversations: new NeonConversationRepository(),
      timeline: new NeonTimelineRepository(),
      followUps: new NeonFollowUpRepository(),
      emails: new NeonEmailMessageRepository(),
      appUsers: new NeonAppUserRepository(),
      connections: new NeonGoogleConnectionRepository(),
    };
  }
  return {
    people: new MemoryPersonRepository(),
    companies: new MemoryCompanyRepository(),
    initiatives: new MemoryInitiativeRepository(),
    conversations: new MemoryConversationRepository(),
    timeline: new MemoryTimelineRepository(),
    followUps: new MemoryFollowUpRepository(),
    emails: new MemoryEmailMessageRepository(),
    appUsers: new MemoryAppUserRepository(),
    connections: new MemoryGoogleConnectionRepository(),
  };
}

function buildAnalysisGateway(mode: ScoringMode = scoringMode()): AnalysisGateway {
  return mode === "live" ? new AnthropicAnalysis() : new FakeAnalysisGateway();
}

function buildGmail(secrets: SecretStore): GmailGateway {
  return process.env.GOOGLE_CLIENT_ID ? new GoogleGmailAdapter(secrets) : new FakeGmailAdapter();
}

/**
 * IntegrationConfigStore (SPEC §6.8): Neon-backed when DATABASE_URL is set, else
 * the in-memory fake. Both write any secret to the SecretStore and persist only
 * the ref — so the SecretStore is its collaborator. Chosen ONLY here (law 6).
 */
function buildIntegrationConfigStore(secrets: SecretStore): IntegrationConfigStore {
  return storageMode() === "neon"
    ? new NeonIntegrationConfigStore(secrets)
    : new MemoryIntegrationConfigStore(secrets);
}

function buildSecretStore(): SecretStore {
  // Live store when any AWS config signal is present — AWS_PROFILE (local/SSO),
  // AWS_REGION, explicit keys, or a configured KMS key. Else the in-memory fake.
  const aws =
    process.env.AWS_PROFILE ||
    process.env.AWS_REGION ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_KMS_KEY_ID;
  return aws ? new AwsSecretsManagerAdapter() : new FakeSecretStore();
}

/**
 * Calendar gateway (SPEC §6.3): the live provider (signature-verifying) when
 * CALENDAR_WEBHOOK_SECRET is configured, else the fake (offline, no signature).
 * Returned as the concrete CalendarProviderAdapter | FakeCalendarGateway so the
 * webhook route can reach `verifySignature` only when the live adapter is wired.
 */
export function buildCalendarGateway(provider = "calendar"): CalendarProviderAdapter | FakeCalendarGateway {
  return process.env.CALENDAR_WEBHOOK_SECRET
    ? new CalendarProviderAdapter(provider)
    : new FakeCalendarGateway();
}

/** The single discovery composition root used by every src/app/api route. */
export function getServices(): DiscoveryServices {
  const repos = buildRepositories();
  const ids = new UuidGenerator();
  const clock = new SystemClock();
  const analysisGateway = buildAnalysisGateway();
  const secrets = buildSecretStore();
  const integrations = buildIntegrationConfigStore(secrets);
  const gmail = buildGmail(secrets);
  const scorer = scoringMode() === "live" ? new AnthropicScorer() : new FakeScorer();

  const resolveIdentity = new ResolveIdentity(repos.people, ids, clock);
  const associateInitiative = new AssociateInitiative(repos.initiatives);
  const ingestRecording = new IngestRecording(
    repos.conversations,
    repos.followUps,
    resolveIdentity,
    associateInitiative,
    ids,
    clock,
  );
  const analyzeConversation = new AnalyzeConversation(
    repos.conversations,
    repos.followUps,
    analysisGateway,
    ids,
    clock,
  );
  const addParticipant = new AddParticipant(repos.conversations, repos.people);
  const runPlaybookCheck = new RunPlaybookCheck(repos.conversations, scorer, ids, clock);
  const regenerateProfile = new RegenerateProfile(repos.timeline, analysisGateway, ids, clock);
  const syncContactEmails = new SyncContactEmails(
    repos.people,
    repos.emails,
    repos.timeline,
    gmail,
    secrets,
    ids,
    clock,
    repos.connections,
  );

  return {
    ...repos,
    ids,
    clock,
    analysisGateway,
    gmail,
    secrets,
    integrations,
    ingestRecording,
    resolveIdentity,
    associateInitiative,
    analyzeConversation,
    addParticipant,
    runPlaybookCheck,
    regenerateProfile,
    syncContactEmails,
  };
}
