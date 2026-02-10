import { z } from 'zod';

// const TASK_VARIANT_STATUS_VALUES = ['deprecated', 'draft', 'published'] as const;

// const TaskVariantStatusSchema = z.enum(TASK_VARIANT_STATUS_VALUES);

// type TaskVariantStatus = z.infer<typeof TaskVariantStatusSchema>;

// const TaskVariantSchema = z.object({
//   id: z.string().uuid(),
//   taskId: z.string().uuid(),
//   name: z.string().min(1).max(255),
//   description: z.string().min(1).max(1024),
//   status: TaskVariantStatusSchema,
// });

// export type TaskVariant = z.infer<typeof TaskVariantSchema>;

// const TASK_VARIANT_SORT_FIELDS = ['taskId', 'name', 'status', 'createdAt', 'updatedAt'] as const;
// type TaskVariantSortFieldType = (typeof TASK_VARIANT_SORT_FIELDS)[number];
// const TaskVariantSortField = {
//   TASK_ID: 'taskId',
//   NAME: 'name',
//   STATUS: 'status',
//   CREATED_AT: 'createdAt',
//   UPDATED_AT: 'updatedAt',
// } as const satisfies Record<string, TaskVariantSortFieldType>;

const TaskVariantParameter = z.object({
  name: z.string().min(1).max(255),
  value: z.string().min(1).max(1024),
});

const TaskVariantParameters = z.array(TaskVariantParameter);

// type TaskVariantParametersSchema = z.infer<typeof TaskVariantParameters>;

export const TaskVariantCreateRequestSchema = z.object({
  taskId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(1024),
  parameters: TaskVariantParameters,
});

export const TaskVariantCreateResponseSchema = z.object({
  status: z.literal('created'),
});

export type TaskVariantCreateResponse = z.infer<typeof TaskVariantCreateResponseSchema>;
