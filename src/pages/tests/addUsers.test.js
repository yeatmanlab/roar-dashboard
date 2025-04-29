import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import AddUsers from '../users/AddUsers.vue';
import AddUsersInfo from '../../components/userInfo/AddUsersInfo.vue';

// Create a mock router
const mockRouter = {
  push: vi.fn()
};

// Create a mock for the Vue Router
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter
}));

// Test utilities
const createValidCSVContent = () => {
  return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
         '1,child,5,2018,,,"Test Site","Test School","Class A","Group 1"\n' +
         '2,caregiver,,,,,"Test Site","Test School","Class A","Group 1"';
};


// Test all possible cases for CSV parsing errors
// - Missing month column 
// - Missing year column
// - Missing userType column
// - Missing month value for child
// - Missing year value for child
// - Site value but no school value
// - School value but no site value
// - Class value but no school and site values
// - No org value entered at all. Must have either Cohort OR Site and School.
// - Incorrect userType value. Must be one of child, teacher, or caregiver.
// - Incorrect month format value. Must be a number between 1 and 12.
// - Incorrect year format value. Must be a four digit number.

const createCSVWithMissingYearForChild = () => {
  return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
         '1,child,5,,,,"Test Site","Test School","Class A","Group 1"';
};

const createCSVWithMissingOrg = () => {
  return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
         '1,child,5,2018,,,,,,';
};

const createCSVWithInvalidUserType = () => {
    return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
           '1,student,5,2018,,,"Test Site","Test School","Class A","Group 1"';
};

const createCSVWithInvalidMonth = () => {
    return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
           '1,child,13,2018,,,"Test Site","Test School","Class A","Group 1"';
};

const createCSVWithInvalidYear = () => {
    return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
           '1,child,5,18,,,"Test Site","Test School","Class A","Group 1"';
};

const createCSVWithSiteNoSchool = () => {
    return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
           '1,child,5,2018,,,"Test Site",,"Class A",""';
};

const createCSVWithSchoolNoSite = () => {
    return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
           '1,child,5,2018,,,,"Test School","Class A",""';
};

const createCSVWithClassNoSchoolSite = () => {
    return 'id,userType,month,year,caregiverId,teacherId,site,school,class,cohort\n' +
           '1,child,5,2018,,,,,"Class A",""';
};

const createMockFile = (content, filename = 'test.csv', type = 'text/csv') => {
  return new File([content], filename, { type });
};

const mockFileUpload = (content) => {
  const mockFile = createMockFile(content);
  return { files: [mockFile] };
};

const setupDownloadMocks = () => {
  // Mock DOM APIs
  const urlCreateObjectUrlMock = vi.fn(() => 'mock-blob-url');
  global.URL.createObjectURL = urlCreateObjectUrlMock;
  
  const appendChildMock = vi.fn();
  const removeChildMock = vi.fn();
  const clickMock = vi.fn();
  
  const createElementOriginal = document.createElement;
  global.document.createElement = vi.fn((tagName) => {
    const element = createElementOriginal.call(document, tagName);
    if (tagName === 'a') {
      element.click = clickMock;
    }
    return element;
  });
  
  global.document.body.appendChild = appendChildMock;
  global.document.body.removeChild = removeChildMock;
  
  return {
    urlCreateObjectUrlMock,
    appendChildMock,
    removeChildMock,
    clickMock,
    createElementOriginal
  };
};

const cleanupDownloadMocks = (createElementOriginal) => {
  global.document.createElement = createElementOriginal;
  global.URL.createObjectURL.mockRestore();
};

describe('Add Users Page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('AddUsersInfo Component', () => {
    it('Downloads the CSV template file', async () => {
      const mocks = setupDownloadMocks();
      
      const wrapper = mount(AddUsersInfo, {
        global: {
          plugins: [PrimeVue, ToastService]
        }
      });
      
      const downloadButton = wrapper.find('button[data-testid="download-template"]');
      await downloadButton.trigger('click');
      
      // Verify URL.createObjectURL was called with a Blob
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      const blob = global.URL.createObjectURL.mock.calls[0][0];
      expect(blob).toBeInstanceOf(Blob);
      
      // Verify link properties and DOM operations
      expect(mocks.appendChildMock).toHaveBeenCalled();
      expect(mocks.clickMock).toHaveBeenCalled();
      expect(mocks.removeChildMock).toHaveBeenCalled();
      
      // Restore original methods
      cleanupDownloadMocks(mocks.createElementOriginal);
    });
  });

  describe('AddUsers Component', () => {
    it('uploads a correctly formatted CSV file and processes the data correctly', async () => {
      const wrapper = mount(AddUsers, {
        global: {
          plugins: [PrimeVue, ToastService] 
        }
      });
      
      // Mock the file upload with valid CSV data
      const mockEventData = mockFileUpload(createValidCSVContent());
      
      // Directly call the onFileUpload method on the component
      await wrapper.vm.onFileUpload(mockEventData);
      
      // Check that rawUserFile is populated with the expected data
      expect(wrapper.vm.rawUserFile).toBeDefined();
      expect(wrapper.vm.rawUserFile.length).toBe(2);
      
      // Verify the first row has the expected values
      const firstRow = wrapper.vm.rawUserFile[0];
      expect(firstRow.userType).toBe('child');
      expect(firstRow.month).toBe('5');
      expect(firstRow.year).toBe('2018');
      expect(firstRow.school).toBe('Test School');
      expect(firstRow.cohort).toBe('Group 1');
      
      // Verify the second row has the expected values
      const secondRow = wrapper.vm.rawUserFile[1];
      expect(secondRow.userType).toBe('caregiver');
      expect(secondRow.site).toBe('Test Site');
      
      // Test that the file uploaded flag is set to true
      expect(wrapper.vm.isFileUploaded).toBe(true);
      
      // Test that no errors are present
      expect(wrapper.vm.errorUsers.length).toBe(0);
      expect(wrapper.vm.errorMissingColumns).toBe(false);

      // Test that the Start Adding button is visible
      const startAddingButton = wrapper.find('button[data-testid="start-adding-button"]');
      expect(startAddingButton.exists()).toBe(true);
      expect(startAddingButton.text()).toBe('Start Adding');
    });

    it('handles validation errors when year is missing for child', async () => {
      const wrapper = mount(AddUsers, {
        global: {
          plugins: [PrimeVue, ToastService]
        }
      });
      const mockEventData = mockFileUpload(createCSVWithMissingYearForChild());
      await wrapper.vm.onFileUpload(mockEventData);
      expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
      expect(wrapper.vm.errorUsers[0].error).toContain('Missing Field(s): year');
      expect(wrapper.vm.showErrorTable).toBe(true);
      expect(wrapper.vm.isFileUploaded).toBe(false);
    });

    it('handles validation errors when missing Groups info (cohort or site+school)', async () => {
        const wrapper = mount(AddUsers, {
            global: { plugins: [PrimeVue, ToastService] }
        });
        const mockEventData = mockFileUpload(createCSVWithMissingOrg());
        await wrapper.vm.onFileUpload(mockEventData);
        expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
        expect(wrapper.vm.errorUsers[0].error).toContain('Cohort OR Site and School');
        expect(wrapper.vm.showErrorTable).toBe(true);
        expect(wrapper.vm.isFileUploaded).toBe(false);
    });

    // Test for Site (District) without School
    it('handles validation errors when site is provided but school is missing', async () => {
        const wrapper = mount(AddUsers, {
            global: { plugins: [PrimeVue, ToastService] }
        });
        const mockEventData = mockFileUpload(createCSVWithSiteNoSchool());
        await wrapper.vm.onFileUpload(mockEventData);
        expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
        // It flags 'cohort OR site and school' because site is present but school is missing
        expect(wrapper.vm.errorUsers[0].error).toContain('Cohort OR Site and School');
        expect(wrapper.vm.showErrorTable).toBe(true);
        expect(wrapper.vm.isFileUploaded).toBe(false);
    });

    // Test for School without Site (District)
    it('handles validation errors when school is provided but site is missing', async () => {
        const wrapper = mount(AddUsers, {
            global: { plugins: [PrimeVue, ToastService] }
        });
        const mockEventData = mockFileUpload(createCSVWithSchoolNoSite());
        await wrapper.vm.onFileUpload(mockEventData);
        expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
        // It flags 'cohort OR site and school' because school is present but site is missing
        expect(wrapper.vm.errorUsers[0].error).toContain('Cohort OR Site and School');
        expect(wrapper.vm.showErrorTable).toBe(true);
        expect(wrapper.vm.isFileUploaded).toBe(false);
    });

    // Test for Class without School and Site (District)
    it('handles validation errors when class is provided but school and site are missing', async () => {
        const wrapper = mount(AddUsers, {
            global: { plugins: [PrimeVue, ToastService] }
        });
        const mockEventData = mockFileUpload(createCSVWithClassNoSchoolSite());
        await wrapper.vm.onFileUpload(mockEventData);
        expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
        // It flags 'cohort OR district and school' because class requires district+school if no cohort
        expect(wrapper.vm.errorUsers[0].error).toContain('Cohort OR Site and School');
        expect(wrapper.vm.showErrorTable).toBe(true);
        expect(wrapper.vm.isFileUploaded).toBe(false);
    });

    it('handles validation error for invalid userType', async () => {
        const wrapper = mount(AddUsers, {
            global: { plugins: [PrimeVue, ToastService] }
        });
        const mockEventData = mockFileUpload(createCSVWithInvalidUserType());
        await wrapper.vm.onFileUpload(mockEventData);
        expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
        expect(wrapper.vm.errorUsers[0].error).toContain('Invalid Field(s): userType must be one of: child, teacher, caregiver');
        expect(wrapper.vm.showErrorTable).toBe(true);
        expect(wrapper.vm.isFileUploaded).toBe(false);
    });

    it('handles validation error for invalid month for child', async () => {
        const wrapper = mount(AddUsers, {
            global: { plugins: [PrimeVue, ToastService] }
        });
        const mockEventData = mockFileUpload(createCSVWithInvalidMonth());
        await wrapper.vm.onFileUpload(mockEventData);
        expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
        expect(wrapper.vm.errorUsers[0].error).toContain('Invalid Field(s): month must be a number between 1 and 12');
        expect(wrapper.vm.showErrorTable).toBe(true);
        expect(wrapper.vm.isFileUploaded).toBe(false);
    });

    it('handles validation error for invalid year format for child', async () => {
        const wrapper = mount(AddUsers, {
            global: { plugins: [PrimeVue, ToastService] }
        });
        const mockEventData = mockFileUpload(createCSVWithInvalidYear());
        await wrapper.vm.onFileUpload(mockEventData);
        expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
        expect(wrapper.vm.errorUsers[0].error).toContain('Invalid Field(s): year must be a four-digit number');
        expect(wrapper.vm.showErrorTable).toBe(true);
        expect(wrapper.vm.isFileUploaded).toBe(false);
    });
  });
});
