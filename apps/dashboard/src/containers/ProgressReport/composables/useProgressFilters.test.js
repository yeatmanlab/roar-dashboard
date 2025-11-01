import { describe, it, expect, beforeEach } from 'vitest';
import { ref, computed, nextTick } from 'vue';
import { useProgressFilters } from './useProgressFilters';

describe('useProgressFilters', () => {
  let mockProgressData;

  beforeEach(() => {
    mockProgressData = computed(() => [
      {
        user: {
          username: 'student1',
          grade: '3',
          schoolName: 'School A',
        },
      },
      {
        user: {
          username: 'student2',
          grade: '4',
          schoolName: 'School B',
        },
      },
      {
        user: {
          username: 'student3',
          grade: '3',
          schoolName: 'School A',
        },
      },
      {
        user: {
          username: 'student4',
          grade: '5',
          schoolName: 'School C',
        },
      },
    ]);
  });

  it('should initialize with unfiltered data', () => {
    const { filteredTableData } = useProgressFilters(mockProgressData);

    expect(filteredTableData.value).toEqual(mockProgressData.value);
    expect(filteredTableData.value).toHaveLength(4);
  });

  it('should filter by school', async () => {
    const { filteredTableData, filterSchools } = useProgressFilters(mockProgressData);

    filterSchools.value = ['School A'];
    await nextTick();

    expect(filteredTableData.value).toHaveLength(2);
    expect(filteredTableData.value.every((item) => item.user.schoolName === 'School A')).toBe(true);
  });

  it('should filter by grade', async () => {
    const { filteredTableData, filterGrades } = useProgressFilters(mockProgressData);

    filterGrades.value = ['3'];
    await nextTick();

    expect(filteredTableData.value).toHaveLength(2);
    expect(filteredTableData.value.every((item) => item.user.grade === '3')).toBe(true);
  });

  it('should filter by both school and grade', async () => {
    const { filteredTableData, filterSchools, filterGrades } = useProgressFilters(mockProgressData);

    filterSchools.value = ['School A'];
    filterGrades.value = ['3'];
    await nextTick();

    expect(filteredTableData.value).toHaveLength(2);
    expect(
      filteredTableData.value.every((item) => item.user.schoolName === 'School A' && item.user.grade === '3'),
    ).toBe(true);
  });

  it('should reset filters', async () => {
    const { filteredTableData, filterSchools, filterGrades, resetFilters } = useProgressFilters(mockProgressData);

    filterSchools.value = ['School A'];
    filterGrades.value = ['3'];
    await nextTick();

    expect(filteredTableData.value).toHaveLength(2);

    resetFilters();
    await nextTick();

    expect(filterSchools.value).toEqual([]);
    expect(filterGrades.value).toEqual([]);
    expect(filteredTableData.value).toEqual(mockProgressData.value);
  });

  it('should update filtered data when progress data changes', async () => {
    const dynamicData = ref([
      {
        user: {
          username: 'student1',
          grade: '3',
          schoolName: 'School A',
        },
      },
    ]);

    const { filteredTableData } = useProgressFilters(computed(() => dynamicData.value));

    expect(filteredTableData.value).toHaveLength(1);

    dynamicData.value = [
      ...dynamicData.value,
      {
        user: {
          username: 'student2',
          grade: '4',
          schoolName: 'School B',
        },
      },
    ];

    await nextTick();

    expect(filteredTableData.value).toHaveLength(2);
  });

  it('should handle empty filter arrays', async () => {
    const { filteredTableData, filterSchools, filterGrades } = useProgressFilters(mockProgressData);

    filterSchools.value = [];
    filterGrades.value = [];
    await nextTick();

    expect(filteredTableData.value).toEqual(mockProgressData.value);
  });

  it('should handle multiple schools filter', async () => {
    const { filteredTableData, filterSchools } = useProgressFilters(mockProgressData);

    filterSchools.value = ['School A', 'School B'];
    await nextTick();

    expect(filteredTableData.value).toHaveLength(3);
    expect(filteredTableData.value.every((item) => ['School A', 'School B'].includes(item.user.schoolName))).toBe(true);
  });

  it('should handle multiple grades filter', async () => {
    const { filteredTableData, filterGrades } = useProgressFilters(mockProgressData);

    filterGrades.value = ['3', '4'];
    await nextTick();

    expect(filteredTableData.value).toHaveLength(3);
    expect(filteredTableData.value.every((item) => ['3', '4'].includes(item.user.grade))).toBe(true);
  });
});
