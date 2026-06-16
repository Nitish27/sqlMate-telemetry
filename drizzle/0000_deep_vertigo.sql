CREATE TABLE "installations" (
	"installation_id" text PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"app_version" text,
	"platform" text DEFAULT 'macos' NOT NULL,
	"channel" text,
	"last_seen_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "installations_last_seen_at_idx" ON "installations" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "installations_last_heartbeat_at_idx" ON "installations" USING btree ("last_heartbeat_at");--> statement-breakpoint
CREATE INDEX "installations_channel_idx" ON "installations" USING btree ("channel");