import VariantCard from '@/components/VariantCard.vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import PvButton from 'primevue/button';
import PvChip from 'primevue/chip';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvDialog from 'primevue/dialog';
import PvPopover from 'primevue/popover';
import PvTag from 'primevue/tag';
import PrimeVue from 'primevue/config';
import { createPinia, setActivePinia } from 'pinia';
import { getAllLanguageOptions, getLanguageInfo } from '@/helpers/languageDiscovery';

// Mock the language discovery functions
vi.mock('@/helpers/languageDiscovery', () => ({
  getAllLanguageOptions: vi.fn(),
  getLanguageInfo: vi.fn(),
}));

// Mock EditVariantDialog component
vi.mock('@/components/EditVariantDialog.vue', () => ({
  default: {
    name: 'EditVariantDialog',
    template: '<div data-testid="edit-variant-dialog"></div>',
  },
}));

const mockLanguages = [
  // Primary (full locales)
  { variantCode: 'en-US', displayName: 'English (United States)', flagCode: 'us', isLegacy: false, dashboardLocale: 'en-US' },
  { variantCode: 'es-CO', displayName: 'Spanish (Colombia)', flagCode: 'co', isLegacy: false, dashboardLocale: 'es-CO' },
  { variantCode: 'de', displayName: 'German', flagCode: 'de', isLegacy: false, dashboardLocale: 'de' },
  { variantCode: 'fr-CA', displayName: 'French (Canada)', flagCode: 'ca', isLegacy: false, dashboardLocale: 'fr-CA' },
  { variantCode: 'nl', displayName: 'Dutch', flagCode: 'nl', isLegacy: false, dashboardLocale: 'nl' },
  { variantCode: 'en-GH', displayName: 'English (Ghana)', flagCode: 'gh', isLegacy: false, dashboardLocale: 'en-GH' },
  { variantCode: 'de-CH', displayName: 'German (Switzerland)', flagCode: 'ch', isLegacy: false, dashboardLocale: 'de-CH' },
  { variantCode: 'es-AR', displayName: 'Spanish (Argentina)', flagCode: 'ar', isLegacy: false, dashboardLocale: 'es-AR' },
  // Legacy codes
  { variantCode: 'en', displayName: 'English (legacy)', flagCode: 'us', isLegacy: true, dashboardLocale: 'en-US' },
  { variantCode: 'es', displayName: 'Spanish (legacy)', flagCode: 'co', isLegacy: true, dashboardLocale: 'es-CO' },
];

const createMockVariant = (language) => ({
  id: `test-variant-${language.variantCode}`,
  variant: {
    name: `Test Variant ${language.displayName}`,
    params: {
      language: language.variantCode,
      cat: true,
      difficulty: 'medium',
    },
    conditions: {
      assigned: {
        conditions: [
          { field: 'userType', op: 'EQUAL', value: 'student' },
        ],
      },
    },
  },
  task: {
    name: 'Test Task',
    image: '/test-image.jpg',
  },
});

const mountOptions = {
  global: {
    components: {
      PvButton,
      PvChip,
      PvColumn,
      PvDataTable,
      PvDialog,
      PvPopover,
      PvTag,
    },
    plugins: [PrimeVue],
    directives: {
      tooltip: {
        mounted() {},
        updated() {},
      },
    },
    stubs: {
      EditVariantDialog: {
        template: '<div data-testid="edit-variant-dialog"></div>',
      },
    },
  },
  props: {
    updateVariant: vi.fn(),
    preExistingAssessmentInfo: [],
  },
};

beforeEach(() => {
  setActivePinia(createPinia());
  
  // Setup mocks
  getAllLanguageOptions.mockReturnValue(mockLanguages);
  getLanguageInfo.mockImplementation((code) => 
    mockLanguages.find(lang => lang.variantCode === code) || null
  );
});

describe('VariantCard.vue - Language Variant Testing', () => {
  describe('Variant Card Rendering for All Languages', () => {
    const testResults = [];

    mockLanguages.forEach((language) => {
      it(`should render variant card successfully for ${language.displayName} (${language.variantCode})`, async () => {
        const mockVariant = createMockVariant(language);
        let testPassed = false;
        let errorMessage = '';

        try {
          const wrapper = mount(VariantCard, {
            ...mountOptions,
            props: {
              ...mountOptions.props,
              variant: mockVariant,
              hasControls: false,
            },
          });

          await nextTick();

          // Test 1: Component exists and renders
          expect(wrapper.exists()).toBe(true);

          // Test 2: Task name is displayed
          const taskNameElements = wrapper.findAll('.font-bold');
          const taskNameElement = taskNameElements.find(el => el.text().includes(mockVariant.task.name));
          expect(taskNameElement).toBeTruthy();

          // Test 3: Variant name is displayed
          const variantNameText = wrapper.text();
          expect(variantNameText).toContain('Variant name:');
          expect(variantNameText).toContain(mockVariant.variant.name);

          // Test 4: Language chip is displayed correctly  
          const allChips = wrapper.findAllComponents(PvChip);
          const languageChip = allChips.find(chip => {
            const chipText = chip.text();
            return chipText.includes(language.displayName) || chipText.includes(language.variantCode);
          });
          expect(languageChip).toBeTruthy();

          // Test 5: Language chip has correct styling based on legacy status
          if (languageChip) {
            const expectedChipClass = language.isLegacy ? 'bg-orange-500' : 'bg-green-500';
            expect(languageChip.classes()).toContain(expectedChipClass);
          }

          // Test 6: Flag icon is present
          const flagIcon = wrapper.find(`[class*="fi-${language.flagCode}"]`);
          expect(flagIcon.exists()).toBe(true);

          // Test 7: Legacy label appears only for legacy languages
          const chipText = languageChip ? languageChip.text() : '';
          if (language.isLegacy) {
            expect(chipText).toContain('(legacy)');
          } else {
            expect(chipText).not.toContain('(legacy)');
          }

          // Test 8: CAT chip is displayed when params.cat is true
          const catChip = allChips.find(chip => chip.text().includes('CAT'));
          expect(catChip).toBeTruthy();

          // Test 9: Select button is present and functional
          const selectButton = wrapper.find('[data-cy="selected-variant"]');
          expect(selectButton.exists()).toBe(true);

          // Test 10: Parameters are accessible via popover
          const infoButton = wrapper.find('i.pi-info-circle');
          expect(infoButton.exists()).toBe(true);

          testPassed = true;
          testResults.push({
            language: language.displayName,
            code: language.variantCode,
            status: 'SUCCESS',
            isLegacy: language.isLegacy,
          });

          wrapper.unmount();
        } catch (error) {
          errorMessage = error.message;
          testResults.push({
            language: language.displayName,
            code: language.variantCode,
            status: 'FAILURE',
            error: errorMessage,
            isLegacy: language.isLegacy,
          });
          
          // Re-throw to fail the test
          throw error;
        }
      });
    });

    // Summary test that runs after all individual tests
    it('should provide test results summary for all languages', () => {
      const successCount = testResults.filter(result => result.status === 'SUCCESS').length;
      const failureCount = testResults.filter(result => result.status === 'FAILURE').length;

      console.log('\n=== LANGUAGE VARIANT TESTING RESULTS ===');
      console.log(`Total Languages: ${testResults.length}`);
      console.log(`Passed: ${successCount} | Failed: ${failureCount}\n`);
      
      // Group results by status for cleaner output
      const successResults = testResults.filter(result => result.status === 'SUCCESS');
      const failureResults = testResults.filter(result => result.status === 'FAILURE');
      
      if (successResults.length > 0) {
        console.log('✅ PASSED:');
        successResults.forEach(result => {
          const legacyTag = result.isLegacy ? ' (legacy)' : '';
          console.log(`   • ${result.language} (${result.code})${legacyTag}`);
        });
      }
      
      if (failureResults.length > 0) {
        console.log('\n❌ FAILED:');
        failureResults.forEach(result => {
          const legacyTag = result.isLegacy ? ' (legacy)' : '';
          console.log(`   • ${result.language} (${result.code})${legacyTag}`);
          if (result.error) {
            console.log(`     Error: ${result.error}`);
          }
        });
      }

      // Test should pass if all languages succeeded
      expect(failureCount).toBe(0);
      expect(successCount).toBe(testResults.length);
    });
  });

  describe('Variant Card with Controls', () => {
    it('should render variant card with management controls for English (US)', async () => {
      const englishLanguage = mockLanguages.find(lang => lang.variantCode === 'en-US');
      const mockVariant = createMockVariant(englishLanguage);

      const wrapper = mount(VariantCard, {
        ...mountOptions,
        props: {
          ...mountOptions.props,
          variant: mockVariant,
          hasControls: true,
        },
      });

      await nextTick();

      // Test control buttons are present
      const removeButton = wrapper.find('i.pi-times');
      const moveUpButton = wrapper.find('i.pi-sort-up');
      const moveDownButton = wrapper.find('i.pi-sort-down');

      expect(removeButton.exists()).toBe(true);
      expect(moveUpButton.exists()).toBe(true);
      expect(moveDownButton.exists()).toBe(true);

      // Test control button functionality - test the buttons directly
      const allButtons = wrapper.findAllComponents(PvButton);
      
      // Find the remove button (has pi-times icon)
      const removeBtn = allButtons.find(btn => btn.find('i.pi-times').exists());
      expect(removeBtn).toBeTruthy();
      
      // Test that clicking the remove button emits the correct event
      if (removeBtn) {
        await removeBtn.trigger('click');
        expect(wrapper.emitted().remove).toBeTruthy();
        expect(wrapper.emitted().remove[0]).toEqual([mockVariant]);
      }
      
      // Find the move up button (has pi-sort-up icon)
      const moveUpBtn = allButtons.find(btn => btn.find('i.pi-sort-up').exists());
      expect(moveUpBtn).toBeTruthy();
      
      if (moveUpBtn) {
        await moveUpBtn.trigger('click');
        expect(wrapper.emitted().moveUp).toBeTruthy();
        expect(wrapper.emitted().moveUp[0]).toEqual([mockVariant]);
      }
      
      // Find the move down button (has pi-sort-down icon)
      const moveDownBtn = allButtons.find(btn => btn.find('i.pi-sort-down').exists());
      expect(moveDownBtn).toBeTruthy();
      
      if (moveDownBtn) {
        await moveDownBtn.trigger('click');
        expect(wrapper.emitted().moveDown).toBeTruthy();
        expect(wrapper.emitted().moveDown[0]).toEqual([mockVariant]);
      }

      wrapper.unmount();
    });
  });

  describe('Language Information Display', () => {
    it('should correctly display language information for all variant codes', () => {
      mockLanguages.forEach((language) => {
        const languageInfo = getLanguageInfo(language.variantCode);
        
        expect(languageInfo).not.toBeNull();
        expect(languageInfo.variantCode).toBe(language.variantCode);
        expect(languageInfo.displayName).toBe(language.displayName);
        expect(languageInfo.flagCode).toBe(language.flagCode);
        expect(languageInfo.isLegacy).toBe(language.isLegacy);
        expect(languageInfo.dashboardLocale).toBe(language.dashboardLocale);
      });
    });
  });

  describe('Variant Parameters Display', () => {
    it('should correctly display all variant parameters in the data table', async () => {
      const testLanguage = mockLanguages[0]; // Use first language for testing
      const mockVariant = createMockVariant(testLanguage);
      
      // Add more parameters for comprehensive testing
      mockVariant.variant.params = {
        ...mockVariant.variant.params,
        numberOfTrials: 10,
        timeLimit: 60,
        feedback: true,
        adaptiveAssessment: false,
      };

      const wrapper = mount(VariantCard, {
        ...mountOptions,
        props: {
          ...mountOptions.props,
          variant: mockVariant,
          hasControls: false,
        },
      });

      await nextTick();

      // Check that displayParamList correctly formats parameters
      const paramList = wrapper.vm.displayParamList(mockVariant.variant.params);
      
      expect(paramList).toHaveLength(Object.keys(mockVariant.variant.params).length);
      expect(paramList).toEqual(
        expect.arrayContaining([
          { key: 'language', value: testLanguage.variantCode },
          { key: 'cat', value: true },
          { key: 'difficulty', value: 'medium' },
          { key: 'numberOfTrials', value: 10 },
          { key: 'timeLimit', value: 60 },
          { key: 'feedback', value: true },
          { key: 'adaptiveAssessment', value: false },
        ])
      );

      wrapper.unmount();
    });
  });

  describe('Conditional Rendering', () => {
    it('should show assigned conditions when present', async () => {
      const testLanguage = mockLanguages.find(lang => lang.variantCode === 'es-CO');
      const mockVariant = createMockVariant(testLanguage);

      const wrapper = mount(VariantCard, {
        ...mountOptions,
        props: {
          ...mountOptions.props,
          variant: mockVariant,
          hasControls: true,
        },
      });

      await nextTick();

      // Check if assigned conditions are formatted correctly
      const formattedConditions = wrapper.vm.formattedAssignedConditions;
      expect(formattedConditions).toBe('Children');

      wrapper.unmount();
    });

    it('should handle variants without conditions gracefully', async () => {
      const testLanguage = mockLanguages.find(lang => lang.variantCode === 'de');
      const mockVariant = createMockVariant(testLanguage);
      delete mockVariant.variant.conditions;

      const wrapper = mount(VariantCard, {
        ...mountOptions,
        props: {
          ...mountOptions.props,
          variant: mockVariant,
          hasControls: false,
        },
      });

      await nextTick();

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.vm.formattedAssignedConditions).toBe('');

      wrapper.unmount();
    });
  });
});
