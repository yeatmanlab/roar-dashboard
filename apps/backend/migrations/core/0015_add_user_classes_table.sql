CREATE TABLE "app"."user_classes" (
	"user_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"role" "app"."user_role" NOT NULL,
	"enrollment_start" timestamp with time zone NOT NULL,
	"enrollment_end" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_classes_pk" PRIMARY KEY("user_id","class_id")
);
--> statement-breakpoint
ALTER TABLE "app"."user_classes" ADD CONSTRAINT "user_classes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_classes" ADD CONSTRAINT "user_classes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "app"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_classes_user_idx" ON "app"."user_classes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_classes_class_idx" ON "app"."user_classes" USING btree ("class_id");

-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS user_classes_set_updated_at ON app.user_classes;
CREATE TRIGGER user_classes_set_updated_at
BEFORE INSERT OR UPDATE ON app.user_classes
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();