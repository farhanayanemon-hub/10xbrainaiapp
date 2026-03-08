CREATE TABLE "favorite_model" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"modelName" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_model_unique" UNIQUE("userId","modelName")
);
--> statement-breakpoint
ALTER TABLE "image" ADD COLUMN "upscaleFactor" text;--> statement-breakpoint
ALTER TABLE "image" ADD COLUMN "compressionQuality" integer;--> statement-breakpoint
ALTER TABLE "favorite_model" ADD CONSTRAINT "favorite_model_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorite_models_user_idx" ON "favorite_model" USING btree ("userId");