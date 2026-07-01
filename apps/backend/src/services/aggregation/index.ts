export { AggregationService, type AggregatedSupportCategories, type SupportLevel } from './support-categories.service';

import { AggregationService } from './support-categories.service';

const aggregationService = AggregationService();
export const aggregateSupportCategories = aggregationService.aggregateSupportCategories;
