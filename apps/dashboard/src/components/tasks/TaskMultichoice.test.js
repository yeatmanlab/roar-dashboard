import { vi } from 'vitest';
import TaskMultichoice from './TaskMultichoice.vue';
import { describeTaskProxyLaunch } from '@/test-support/taskProxyLaunch';
import TaskLauncher from '@roar-platform/roar-multichoice';

// `vi.mock` is file-local and its paths must be literals, so each spec declares
// its own module mocks; the shared suite asserts the contract against them.
vi.mock('vue-router', () => ({
  useRouter: () => ({ go: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/composables/useParticipantId', () => ({ default: vi.fn() }));

vi.mock('@/composables/queries/useUserStudentDataQuery', () => ({ default: vi.fn() }));

vi.mock('@roar-platform/roar-multichoice', () => ({
  default: vi.fn().mockImplementation(() => ({ run: vi.fn().mockResolvedValue(undefined) })),
}));

describeTaskProxyLaunch({
  name: 'TaskMultichoice',
  component: TaskMultichoice,
  taskSlug: 'morphology',
  launcher: TaskLauncher,
  contextArgIndex: 3,
  props: { language: 'en' },
});
