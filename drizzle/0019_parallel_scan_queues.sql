ALTER TABLE "scans" ADD COLUMN "seo_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "aeo_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "ai_triggered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "aeo_expected" boolean DEFAULT false NOT NULL;
