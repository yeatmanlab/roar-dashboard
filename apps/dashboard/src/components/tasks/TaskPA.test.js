import { vi } from 'vitest';
import TaskPA from './TaskPA.vue';
import { describeTaskProxyLaunch } from '@/test-support/taskProxyLaunch';

// `vi.mock` is file-local and its paths must be literals, so each spec declares
// its own module mocks; the shared suite asserts the contract against them.
vi.mock('vue-router', () => ({
  useRouter: () => ({ go: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/clients/roar-api', () => ({ getRoarApiClient: vi.fn() }));

vi.mock('@/composables/queries/useUserStudentDataQuery', () => ({ default: vi.fn() }));

vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  getVariantById: vi.fn(),
  initFirekitCompat: vi.fn(),
}));

vi.mock('@roar-platform/roar-pa', () => ({
  default: vi.fn().mockImplementation(() => ({ run: vi.fn().mockResolvedValue(undefined) })),
}));

describeTaskProxyLaunch({
  name: 'TaskPA',
  component: TaskPA,
  taskSlug: 'pa',
  props: { language: 'en' },
  readiness: 'firekit',
});
