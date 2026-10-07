import { vi } from 'vitest';
import TaskReadAloud from './TaskReadAloud.vue';
import { describeTaskProxyLaunch } from '@/test-support/taskProxyLaunch';
import TaskLauncher from '@roar-platform/roar-readaloud';

// `vi.mock` is file-local and its paths must be literals, so each spec declares
// its own module mocks; the shared suite asserts the contract against them.
vi.mock('vue-router', () => ({
  useRouter: () => ({ go: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/composables/useParticipantId', () => ({ default: vi.fn() }));

vi.mock('@/composables/queries/useUserStudentDataQuery', () => ({ default: vi.fn() }));

vi.mock('@roar-platform/roar-readaloud', () => ({
  default: vi.fn().mockImplementation(() => ({ run: vi.fn().mockResolvedValue(undefined) })),
}));

describeTaskProxyLaunch({
  name: 'TaskReadAloud',
  component: TaskReadAloud,
  taskSlug: 'roar-readaloud',
  launcher: TaskLauncher,
  contextArgIndex: 3,
  props: { language: 'en' },
});
