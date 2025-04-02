import { withSetup } from '@/test-support/withSetup.ts';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { fetchDocumentsById } from '@/helpers/query/utils';
import useAdministrationsListQuery from './useAdministrationsListQuery';

// ... existing code ... 