import { vi } from 'vitest';
import TaskLevante from './TaskLevante.vue';
import { describeTaskProxyLaunch } from '@/test-support/taskProxyLaunch';

// `vi.mock` is file-local and its paths must be literals, so each spec declares
// its own module mocks; the shared suite asserts the contract against them.
vi.mock('vue-router', () => ({
  useRouter: () => ({ go: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/composables/useParticipantId', () => ({ default: vi.fn() }));

vi.mock('@/composables/queries/useUserStudentDataQuery', () => ({ default: vi.fn() }));

vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  getVariantById: vi.fn(),
  initFirekitCompat: vi.fn(),
}));

vi.mock('@roar-platform/roar-levante-tasks', () => ({
  TaskLauncher: vi.fn().mockImplementation(() => ({ run: vi.fn().mockResolvedValue(undefined) })),
}));

describeTaskProxyLaunch({
  name: 'TaskLevante',
  component: TaskLevante,
  taskSlug: 'egma-math',
});
