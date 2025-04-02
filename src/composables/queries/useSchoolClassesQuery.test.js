import { withSetup } from '@/test-support/withSetup.ts';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { fetchDocsById } from '@/helpers/query/utils';
import useSchoolClassesQuery from './useSchoolClassesQuery.ts';

// ... existing code ... 