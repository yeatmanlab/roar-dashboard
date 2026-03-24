ALTER TABLE "app"."task_variant_parameters" DROP CONSTRAINT "task_variant_parameters_task_variant_id_task_variants_id_fk";
--> statement-breakpoint
DROP INDEX "app"."task_variant_parameters_name_variant_id_idx";--> statement-breakpoint
ALTER TABLE "app"."task_variant_parameters" DROP CONSTRAINT "task_variant_parameters_pkey";--> statement-breakpoint
ALTER TABLE "app"."task_variant_parameters" ADD CONSTRAINT "task_variant_parameters_pkey" PRIMARY KEY("task_variant_id","name");--> statement-breakpoint
ALTER TABLE "app"."task_variant_parameters" ADD CONSTRAINT "task_variant_parameters_task_variant_id_task_variants_id_fk" FOREIGN KEY ("task_variant_id") REFERENCES "app"."task_variants"("id") ON DELETE cascade ON UPDATE no action;