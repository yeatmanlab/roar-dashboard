/**
 * Task Variant Status Enum
 *
 * Enumerates the available task variant statuses.
 */
import { taskVariantStatusEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const TaskVariantStatus = pgEnumToConst(taskVariantStatusEnum);

export type TaskVariantStatus = (typeof taskVariantStatusEnum.enumValues)[number];
