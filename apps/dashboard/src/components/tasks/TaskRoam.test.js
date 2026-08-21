import { vi } from 'vitest';
import TaskRoam from './TaskRoam.vue';
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

vi.mock('@roar-platform/roam-apps', () => ({
  TaskLauncher: vi.fn().mockImplementation(() => ({ run: vi.fn().mockResolvedValue(undefined) })),
}));

describeTaskProxyLaunch({
  name: 'TaskRoam',
  component: TaskRoam,
  taskSlug: 'fluency-arf',
});

// ROAM is language-as-task — each language is a distinct slug — so the suffixed
// variant has to resolve through the same contract as the base slug.
describeTaskProxyLaunch({
  name: 'TaskRoam (Spanish)',
  component: TaskRoam,
  taskSlug: 'fluency-arf-es',
});
