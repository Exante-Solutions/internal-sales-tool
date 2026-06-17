CREATE TABLE "user_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"app_user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"kind" text NOT NULL,
	"scope" text DEFAULT 'user' NOT NULL,
	"secret_ref" text,
	"config_jsonb" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_integration_app_user_kind_uq" UNIQUE("app_user_id","kind")
);
--> statement-breakpoint
ALTER TABLE "follow_up" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_integration" ADD CONSTRAINT "user_integration_app_user_id_app_user_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integration" ADD CONSTRAINT "user_integration_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;