CREATE TABLE "analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"recorder_summary_md" text,
	"summary_md" text,
	"sentiment" text,
	"what_we_learned_jsonb" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signals_jsonb" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"auth0_sub" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_auth0_sub_unique" UNIQUE("auth0_sub")
);
--> statement-breakpoint
CREATE TABLE "coaching_evaluation" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"rubric_id" text NOT NULL,
	"score_100" integer NOT NULL,
	"band" text NOT NULL,
	"headline_md" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"company_id" text NOT NULL,
	"title" text,
	"started_on" text,
	"ended_on" text,
	"is_current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"provider" text,
	"external_id" text,
	"title" text NOT NULL,
	"reason_md" text DEFAULT '' NOT NULL,
	"outcome_md" text DEFAULT '' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_provider_external_uq" UNIQUE("provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_initiative" (
	"conversation_id" text NOT NULL,
	"initiative_id" text NOT NULL,
	CONSTRAINT "conversation_initiative_conversation_id_initiative_id_pk" PRIMARY KEY("conversation_id","initiative_id")
);
--> statement-breakpoint
CREATE TABLE "email_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"email_normalized" text NOT NULL,
	"label" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "email_identity_email_normalized_unique" UNIQUE("email_normalized")
);
--> statement-breakpoint
CREATE TABLE "email_message" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"rfc_message_id" text NOT NULL,
	"thread_id" text,
	"from_email" text NOT NULL,
	"to_emails_jsonb" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text,
	"snippet" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"synced_by_user_id" text NOT NULL,
	CONSTRAINT "email_message_rfc_message_id_unique" UNIQUE("rfc_message_id")
);
--> statement-breakpoint
CREATE TABLE "follow_up" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"text" text NOT NULL,
	"owner_person_id" text,
	"owner_user_id" text,
	"due_on" text,
	"status" text DEFAULT 'open' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"app_user_id" text NOT NULL,
	"google_sub" text NOT NULL,
	"scopes" text,
	"secret_ref" text NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "initiative" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"goal_md" text DEFAULT '' NOT NULL,
	"hypothesis_md" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "initiative_calendar_link" (
	"id" text PRIMARY KEY NOT NULL,
	"initiative_id" text NOT NULL,
	"app_user_id" text NOT NULL,
	"provider" text NOT NULL,
	"link_id" text NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "initiative_target" (
	"id" text PRIMARY KEY NOT NULL,
	"initiative_id" text NOT NULL,
	"person_id" text NOT NULL,
	"status" text DEFAULT 'to_contact' NOT NULL,
	"reason_md" text,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_target_initiative_person_uq" UNIQUE("initiative_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "item_score" (
	"id" text PRIMARY KEY NOT NULL,
	"coaching_evaluation_id" text NOT NULL,
	"rubric_item_id" integer NOT NULL,
	"score_1_5" integer NOT NULL,
	"rationale_md" text DEFAULT '' NOT NULL,
	"cite_ts_seconds" integer,
	"cite_quote" text
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"person_id" text NOT NULL,
	"email_used" text NOT NULL,
	"company_at_time" text,
	"role_at_time" text
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"primary_display_name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"merged_into_id" text
);
--> statement-breakpoint
CREATE TABLE "profile_summary" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"summary_md" text DEFAULT '' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_entry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_seg" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"idx" integer NOT NULL,
	"speaker" text NOT NULL,
	"text" text NOT NULL,
	"ts_seconds" integer
);
--> statement-breakpoint
ALTER TABLE "analysis" ADD CONSTRAINT "analysis_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_evaluation" ADD CONSTRAINT "coaching_evaluation_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_membership" ADD CONSTRAINT "company_membership_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_membership" ADD CONSTRAINT "company_membership_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_initiative" ADD CONSTRAINT "conversation_initiative_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_initiative" ADD CONSTRAINT "conversation_initiative_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_identity" ADD CONSTRAINT "email_identity_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_connection" ADD CONSTRAINT "google_connection_app_user_id_app_user_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_calendar_link" ADD CONSTRAINT "initiative_calendar_link_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_calendar_link" ADD CONSTRAINT "initiative_calendar_link_app_user_id_app_user_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_target" ADD CONSTRAINT "initiative_target_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_target" ADD CONSTRAINT "initiative_target_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_score" ADD CONSTRAINT "item_score_coaching_evaluation_id_coaching_evaluation_id_fk" FOREIGN KEY ("coaching_evaluation_id") REFERENCES "public"."coaching_evaluation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_seg" ADD CONSTRAINT "transcript_seg_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;