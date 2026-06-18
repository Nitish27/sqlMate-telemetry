CREATE TABLE "download_clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"channel" text NOT NULL,
	"app_version" text,
	"last_seen_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "download_clicks_created_at_idx" ON "download_clicks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "download_clicks_channel_idx" ON "download_clicks" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "download_clicks_source_idx" ON "download_clicks" USING btree ("source");