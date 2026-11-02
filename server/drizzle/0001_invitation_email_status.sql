ALTER TABLE "action_tokens" ADD COLUMN "email_status" text;--> statement-breakpoint
ALTER TABLE "action_tokens" ADD COLUMN "email_error" text;--> statement-breakpoint
ALTER TABLE "action_tokens" ADD COLUMN "email_attempted_at" timestamp with time zone;