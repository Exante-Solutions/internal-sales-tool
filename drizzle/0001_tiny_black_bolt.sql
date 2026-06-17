ALTER TABLE "google_connection" ADD COLUMN "team_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "google_connection" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "google_connection" ADD CONSTRAINT "google_connection_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_connection" ADD CONSTRAINT "google_connection_app_user_id_unique" UNIQUE("app_user_id");