import { vi } from 'vitest';
import TaskLetter from './TaskLetter.vue';
import { describeTaskProxyLaunch } from '@/test-support/taskProxyLaunch';
import TaskLauncher from '@roar-platform/roar-letter';

// `vi.mock` is file-local and its paths must be literals, so each spec declares
// its own module mocks; the shared suite asserts the contract against them.
vi.mock('vue-router', () => ({
  useRouter: () => ({ go: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/composables/useParticipantId', () => ({ default: vi.fn() }));

vi.mock('@/composables/queries/useUserStudentDataQuery', () => ({ default: vi.fn() }));

vi.mock('@roar-platform/roar-letter', () => ({
  default: vi.fn().mockImplementation(() => ({ run: vi.fn().mockResolvedValue(undefined) })),
}));

describeTaskProxyLaunch({
  name: 'TaskLetter',
  component: TaskLetter,
  taskSlug: 'letter',
  launcher: TaskLauncher,
  contextArgIndex: 3,
  props: { language: 'en' },
});
