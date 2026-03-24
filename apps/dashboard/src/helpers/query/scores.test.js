import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDistrictSupportCategories } from './scores';
import { createTestingPinia } from '@pinia/testing';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
const mockSupportCategoriesData = {
  swr: {
    above: {
      schools: {
        school1: 7,
        school2: 6,
      },
      grades: {
        K: 6,
        1: 4,
        2: 3,
      },
      total: 13,
    },
    some: {
      schools: {
        school1: 10,
        school2: 9,
      },
      grades: {
        K: 5,
        1: 5,
        2: 9,
      },
      total: 19,
    },
    below: {
      schools: {
        school1: 3,
        school2: 3,
      },
      grades: {
        K: 2,
        1: 3,
        2: 1,
      },
      total: 6,
    },
    raw: {
      '0-99': {
        schools: {
          school1: 7,
          school2: 6,
        },
        grades: {
          K: 6,
          1: 4,
          2: 3,
        },
        total: 13,
      },
      '400-499': {
        schools: {
          school1: 10,
          school2: 9,
        },
        grades: {
          K: 5,
          1: 5,
          2: 9,
        },
        total: 19,
      },
      '600-699': {
        schools: {
          school1: 3,
          school2: 3,
        },
        grades: {
          K: 2,
          1: 3,
          2: 1,
        },
        total: 6,
      },
    },
    percentile: {
      '0-9': {
        schools: {
          school1: 7,
          school2: 6,
        },
        grades: {
          K: 6,
          1: 4,
          2: 3,
        },
        total: 13,
      },
      '30-39': {
        schools: {
          school1: 10,
          school2: 9,
        },
        grades: {
          K: 5,
          1: 5,
          2: 9,
        },
        total: 19,
      },
      '49-59': {
        schools: {
          school1: 3,
          school2: 3,
        },
        grades: {
          K: 2,
          1: 3,
          2: 1,
        },
        total: 6,
      },
    },
  },
};

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    storeToRefs: vi.fn(),
  };
});

describe('query/scores', () => {
  let aggregateSupportCategoriesMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // 1. Create the mocked function that will be used throughout the test
    aggregateSupportCategoriesMock = vi.fn().mockResolvedValue(mockSupportCategoriesData);

    // 2. Create testing pinia and get auth store in one step
    const pinia = createTestingPinia();
    const authStore = useAuthStore(pinia);

    // 3. Setup the auth store with roarfirekit
    authStore.roarfirekit = {
      aggregateSupportCategories: aggregateSupportCategoriesMock,
    };

    // 4. Configure storeToRefs to return what we need
    storeToRefs.mockReturnValue({
      roarfirekit: { value: authStore.roarfirekit },
    });
  });

  it('should call aggregateSupportCategories with correct parameters', async () => {
    const result = await getDistrictSupportCategories('test-district', 'test-assignment');

    expect(aggregateSupportCategoriesMock).toHaveBeenCalledWith('test-district', 'test-assignment');

    expect(result).toEqual(mockSupportCategoriesData);
  });
});
