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
  return 'id,userType,month,year,parentId,teacherId,site,school,class,group\n' +
         '1,child,5,2018,,,"Test Site","Test School","Class A","Group 1"\n' +
         '2,parent,,,,,"Test Site","Test School","Class A","Group 1"';
};

const createInvalidCSVContent = () => {
  return 'id,userType,month,year,parentId,teacherId,site,school,class,group\n' +
         '1,child,,2018,,,"Test Site","Test School","Class A","Group 1"\n' +
         '2,parent,,,,,"Test Site","Test School","Class A","Group 1"';
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
      expect(firstRow.group).toBe('Group 1');
      
      // Verify the second row has the expected values
      const secondRow = wrapper.vm.rawUserFile[1];
      expect(secondRow.userType).toBe('parent');
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

    it('handles validation errors when CSV file is missing required fields', async () => {
      const wrapper = mount(AddUsers, {
        global: {
          plugins: [PrimeVue, ToastService]
        }
      });

      // Mock the file upload with invalid CSV data (missing month field for a child)
      const mockEventData = mockFileUpload(createInvalidCSVContent());
      
      await wrapper.vm.onFileUpload(mockEventData);
      
      // Verify error handling
      
      // 1. The error users array should be populated
      expect(wrapper.vm.errorUsers.length).toBeGreaterThan(0);
      
      // 2. First error user should contain the specific error message about missing month
      const firstErrorUser = wrapper.vm.errorUsers[0];
      expect(firstErrorUser.error).toBe('Missing Field(s): month');
      
      // 3. The showErrorTable flag should be true
      expect(wrapper.vm.showErrorTable).toBe(true);
      
      // 4. The isFileUploaded flag should be false since there are errors
      expect(wrapper.vm.isFileUploaded).toBe(false);
    });
  });
});
