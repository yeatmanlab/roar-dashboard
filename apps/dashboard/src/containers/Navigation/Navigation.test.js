import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { faker } from '@faker-js/faker';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { useRoute, useRouter } from 'vue-router';
import Navigation from './Navigation.vue';
import NavBar from '@/components/NavBar';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { useAuthStore } from '@/store/auth';
import { usePermissions } from '@/composables/usePermissions';
import mockUserClaims from '@/test-support/mocks/mockUserClaims';
import mockPermissions from '@/test-support/mocks/mockPermissions';

vi.mock('vue-router', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useRoute: vi.fn(),
    useRouter: vi.fn(),
  };
});

vi.mock('@/composables/queries/useUserClaimsQuery');
vi.mock('@/composables/usePermissions');

const firstName = faker.person.firstName();
const lastName = faker.person.lastName();
const displayName = faker.internet.username({ firstName, lastName });
const username = faker.internet.username({ firstName });
const email = faker.internet.email({ firstName, provider: 'roar-auth.com' });

const testingPinia = createTestingPinia();
const authStore = useAuthStore();

authStore.roarfirekit = {
  restConfig: vi.fn().mockReturnValue(true),
};

const defaultUserData = {
  name: {
    first: firstName,
    last: lastName,
  },
  username: username,
  displayName: displayName,
  email: email,
};

authStore.userData = { ...defaultUserData };

describe('<Navigation />', () => {
  let wrapper;
  let mockRoute;

  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    // Reset authStore.userData to default state
    authStore.userData = { ...defaultUserData };

    mockRoute = {
      name: 'Dashboard',
    };

    vi.mocked(useUserClaimsQuery).mockReturnValue({
      isLoading: false,
      data: mockUserClaims,
    });
    vi.mocked(usePermissions).mockReturnValue({
      userCan: vi.fn().mockReturnValue(false),
      Permissions: mockPermissions,
    });

    useRoute.mockReturnValue(mockRoute);
    useRouter.mockReturnValue(mockRouter);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders the <NavBar /> component', () => {
    wrapper = mount(Navigation, {
      global: {
        plugins: [testingPinia, VueQueryPlugin],
        stubs: {
          NavBar: true,
        },
      },
    });

    const navbarComponent = wrapper.findComponent(NavBar);
    expect(navbarComponent.exists()).toBe(true);
    expect(navbarComponent.props()).toMatchObject({
      displayName: firstName,
    });
  });

  it('does not render the <NavBar /> component on blacklisted pages', () => {
    mockRoute.name = 'SignIn';
    wrapper = mount(Navigation, {
      global: {
        plugins: [testingPinia, VueQueryPlugin],
        stubs: {
          NavBar: true,
        },
      },
    });

    const navbarComponent = wrapper.findComponent(NavBar);
    expect(navbarComponent.exists()).toBe(false);
  });

  describe('display name', () => {
    it("should render the user's first name as default display name", () => {
      wrapper = mount(Navigation, {
        global: {
          plugins: [testingPinia, VueQueryPlugin],
          stubs: {
            NavBar: true,
          },
        },
      });

      const navbarComponent = wrapper.findComponent(NavBar);
      expect(navbarComponent.props()).toMatchObject({
        displayName: firstName,
      });
    });

    it("should render the user's display name if the first name is not set", () => {
      delete authStore.userData.name.first;

      wrapper = mount(Navigation, {
        global: {
          plugins: [testingPinia, VueQueryPlugin],
          stubs: {
            NavBar: true,
          },
        },
      });

      const navbarComponent = wrapper.findComponent(NavBar);
      expect(navbarComponent.props()).toMatchObject({
        displayName: displayName,
      });
    });

    it("should render the user's username if the display name and first name are not set", () => {
      delete authStore.userData.name.first;
      delete authStore.userData.displayName;

      wrapper = mount(Navigation, {
        global: {
          plugins: [testingPinia, VueQueryPlugin],
          stubs: {
            NavBar: true,
          },
        },
      });

      const navbarComponent = wrapper.findComponent(NavBar);
      expect(navbarComponent.props()).toMatchObject({
        displayName: username,
      });
    });

    it('should render the email local part as display name for roar-auth.com users without', () => {
      delete authStore.userData.name.first;
      delete authStore.userData.displayName;
      delete authStore.userData.username;

      wrapper = mount(Navigation, {
        global: {
          plugins: [testingPinia, VueQueryPlugin],
          stubs: {
            NavBar: true,
          },
        },
      });

      const navbarComponent = wrapper.findComponent(NavBar);
      expect(navbarComponent.props()).toMatchObject({
        displayName: email.split('@')[0],
      });
    });

    it('should render the user type as final fall back for display name', () => {
      authStore.userData = undefined;

      wrapper = mount(Navigation, {
        global: {
          plugins: [testingPinia, VueQueryPlugin],
          stubs: {
            NavBar: true,
          },
        },
      });

      const navbarComponent = wrapper.findComponent(NavBar);
      expect(navbarComponent.props()).toMatchObject({
        displayName: 'User',
      });
    });
  });
});
