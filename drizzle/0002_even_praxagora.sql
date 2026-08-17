CREATE TABLE "download_leads" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"usage_type" text NOT NULL,
	"source" text NOT NULL,
	"channel" text NOT NULL,
	"app_version" text,
	"last_seen_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "download_leads_created_at_idx" ON "download_leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "download_leads_email_idx" ON "download_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "download_leads_usage_type_idx" ON "download_leads" USING btree ("usage_type");