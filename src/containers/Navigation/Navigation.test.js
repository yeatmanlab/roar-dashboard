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
import mockUserClaims, {
  mockSuperAdminUserClaims,
  mockPartnerAdminUserClaims,
} from '@/test-support/mocks/mockUserClaims';

vi.mock('vue-router', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useRoute: vi.fn(),
    useRouter: vi.fn(),
  };
});

vi.mock('@/composables/queries/useUserClaimsQuery');

const firstName = faker.person.firstName();
const lastName = faker.person.lastName();
const displayName = faker.internet.username({ firstName, lastName });
const username = faker.internet.username({ firstName });
const email = faker.internet.email({ firstName, provider: 'roar-auth.com' });

const testingPinia = createTestingPinia();
const authStore = useAuthStore();

authStore.roarfirekit = {
  restConfig: true,
};

authStore.userData = {
  name: {
    first: firstName,
    last: lastName,
  },
  username: username,
  displayName: displayName,
  email: email,
};

describe('<Navigation />', () => {
  let wrapper;
  let mockRoute;

  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    mockRoute = {
      name: 'Dashboard',
    };

    vi.mocked(useUserClaimsQuery).mockReturnValue({
      isLoading: false,
      data: mockUserClaims,
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
      delete authStore.userData;

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

  describe('logo', () => {
    it('should render the default logo by default', () => {
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
        logo: null,
      });
    });

    it('should render custom logo in Levante mode', () => {
      vi.stubEnv('MODE', 'LEVANTE');

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
        logo: '/LEVANTE/Levante_Logo.png',
      });
    });
  });

  describe('account settings', () => {
    it('should hide the account settings for participants', () => {
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
        showAccountSettingsLink: false,
      });
    });

    it('should show the account settings for partner admins', () => {
      vi.mocked(useUserClaimsQuery).mockReturnValue({
        isLoading: false,
        data: mockPartnerAdminUserClaims,
      });

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
        showAccountSettingsLink: true,
      });
    });

    it('should show the account settings for super admins', () => {
      vi.mocked(useUserClaimsQuery).mockReturnValue({
        isLoading: false,
        data: mockSuperAdminUserClaims,
      });

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
        showAccountSettingsLink: true,
      });
    });
  });
});
