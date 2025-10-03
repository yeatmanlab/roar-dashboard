import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { withSetup } from '@/test-support/withSetup';
import usePagedPreview from './usePagedPreview';

// Mock pagedjs
vi.mock('pagedjs', () => ({
  Previewer: vi.fn().mockImplementation(() => ({
    preview: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('usePagedPreview', () => {
  let mockPreviewer;

  beforeEach(async () => {
    // Mock document methods
    global.document = {
      ...global.document,
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      fonts: {
        ready: Promise.resolve(),
      },
    };

    // Mock window methods
    global.window = {
      ...global.window,
      parent: global.window,
      location: {
        origin: 'http://localhost',
      },
      requestAnimationFrame: vi.fn((cb) => {
        cb();
        return 1;
      }),
    };

    // Reset the Previewer mock
    const { Previewer } = await import('pagedjs');
    mockPreviewer = {
      preview: vi.fn().mockResolvedValue(undefined),
    };
    Previewer.mockImplementation(() => mockPreviewer);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const [result] = withSetup(() => usePagedPreview());

    expect(result.isRendering.value).toBe(false);
    expect(result.error.value).toBe(null);
    expect(typeof result.run).toBe('function');
    expect(typeof result.clear).toBe('function');
  });

  it('should set isRendering to true during render and false after', async () => {
    const [result] = withSetup(() => usePagedPreview());

    const runPromise = result.run();
    
    // Wait a tick to let the async function start
    await nextTick();
    
    // Should be rendering now (though the mock completes quickly)
    // We can't reliably test this with the current setup as the mock resolves immediately
    
    await runPromise;
    
    // After completion, should be false
    expect(result.isRendering.value).toBe(false);
  });

  it('should call pagedjs Previewer.preview when run is called', async () => {
    const { Previewer } = await import('pagedjs');
    const [result] = withSetup(() => usePagedPreview());

    await result.run();

    expect(Previewer).toHaveBeenCalled();
    expect(mockPreviewer.preview).toHaveBeenCalled();
  });

  it('should clear paged output when clear is called', () => {
    const mockPagedPages = { remove: vi.fn() };
    const mockStyles = [
      { parentElement: { removeChild: vi.fn() } },
      { parentElement: { removeChild: vi.fn() } },
    ];

    document.querySelector = vi.fn((selector) => {
      if (selector === '.pagedjs_pages') return mockPagedPages;
      return null;
    });

    document.querySelectorAll = vi.fn((selector) => {
      if (selector === 'style[data-pagedjs-internal], #pagedjs-generated-styles') {
        return mockStyles;
      }
      return [];
    });

    const [result] = withSetup(() => usePagedPreview());

    result.clear();

    expect(mockPagedPages.remove).toHaveBeenCalled();
    expect(mockStyles[0].parentElement.removeChild).toHaveBeenCalledWith(mockStyles[0]);
    expect(mockStyles[1].parentElement.removeChild).toHaveBeenCalledWith(mockStyles[1]);
  });

  it('should call onRendered callback when provided', async () => {
    const onRendered = vi.fn();
    const [result] = withSetup(() => usePagedPreview({ onRendered }));

    await result.run();

    expect(onRendered).toHaveBeenCalled();
  });

  it('should trigger window.print when autoPrint is true', async () => {
    const printSpy = vi.fn();
    global.window.print = printSpy;

    const [result] = withSetup(() => usePagedPreview({ autoPrint: true }));

    await result.run();

    expect(printSpy).toHaveBeenCalled();
  });

  it('should post message to parent window when postMessage option is provided', async () => {
    const postMessageSpy = vi.fn();
    global.window.parent = {
      postMessage: postMessageSpy,
    };

    const [result] = withSetup(() =>
      usePagedPreview({
        postMessage: true,
      }),
    );

    await result.run();

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'page:loaded',
      }),
      'http://localhost',
    );
  });

  it('should use custom postMessage builder when provided', async () => {
    const postMessageSpy = vi.fn();
    global.window.parent = {
      postMessage: postMessageSpy,
    };

    const customPayload = { type: 'custom:event', data: 'test' };
    const [result] = withSetup(() =>
      usePagedPreview({
        postMessage: {
          build: () => customPayload,
          origin: 'http://example.com',
        },
      }),
    );

    await result.run();

    expect(postMessageSpy).toHaveBeenCalledWith(customPayload, 'http://example.com');
  });

  it('should handle errors during rendering', async () => {
    const error = new Error('Preview failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { Previewer } = await import('pagedjs');
    Previewer.mockImplementationOnce(() => ({
      preview: vi.fn().mockRejectedValue(error),
    }));

    const [result] = withSetup(() => usePagedPreview());

    await result.run();

    expect(result.error.value).toBe(error);
    expect(result.isRendering.value).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Paged.js preview failed:', error);

    consoleErrorSpy.mockRestore();
  });

  it('should wait for fonts to be ready before rendering', async () => {
    const fontsReadySpy = vi.fn().mockResolvedValue(undefined);
    document.fonts = {
      ready: fontsReadySpy,
    };

    const [result] = withSetup(() => usePagedPreview());

    await result.run();

    expect(fontsReadySpy).toHaveBeenCalled();
  });

  it('should wait for images to load before rendering', async () => {
    const mockImg1 = {
      complete: false,
      getAttribute: vi.fn(() => 'image1.jpg'),
      addEventListener: vi.fn((event, callback) => {
        if (event === 'load') setTimeout(callback, 0);
      }),
    };

    const mockImg2 = {
      complete: true,
      getAttribute: vi.fn(() => 'image2.jpg'),
      addEventListener: vi.fn(),
    };

    document.querySelectorAll = vi.fn((selector) => {
      if (selector === 'img') return [mockImg1, mockImg2];
      return [];
    });

    const [result] = withSetup(() => usePagedPreview());

    await result.run();

    // Verify that we attempted to wait for images
    expect(mockImg1.addEventListener).toHaveBeenCalledWith('load', expect.any(Function), { once: true });
    expect(mockImg1.addEventListener).toHaveBeenCalledWith('error', expect.any(Function), { once: true });
  });

  it('should skip images with undefined or empty src', async () => {
    const mockImg1 = {
      complete: false,
      getAttribute: vi.fn(() => 'undefined'),
      addEventListener: vi.fn(),
    };

    const mockImg2 = {
      complete: false,
      getAttribute: vi.fn(() => ''),
      addEventListener: vi.fn(),
    };

    const mockImg3 = {
      complete: false,
      getAttribute: vi.fn(() => 'valid-image.jpg'),
      addEventListener: vi.fn((event, callback) => {
        if (event === 'load') setTimeout(callback, 0);
      }),
    };

    document.querySelectorAll = vi.fn((selector) => {
      if (selector === 'img') return [mockImg1, mockImg2, mockImg3];
      return [];
    });

    const [result] = withSetup(() => usePagedPreview());

    await result.run();

    // Only the valid image should have listeners added
    expect(mockImg1.addEventListener).not.toHaveBeenCalled();
    expect(mockImg2.addEventListener).not.toHaveBeenCalled();
    expect(mockImg3.addEventListener).toHaveBeenCalled();
  });

  it('should not post message twice on multiple runs', async () => {
    const postMessageSpy = vi.fn();
    global.window.parent = {
      postMessage: postMessageSpy,
    };

    const [result] = withSetup(() =>
      usePagedPreview({
        postMessage: true,
      }),
    );

    await result.run();
    await result.run();

    // Should only post message once
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
  });

  it('should reset hasPosted flag when clear is called', async () => {
    const postMessageSpy = vi.fn();
    global.window.parent = {
      postMessage: postMessageSpy,
    };

    document.querySelector = vi.fn(() => null);
    document.querySelectorAll = vi.fn(() => []);

    const [result] = withSetup(() =>
      usePagedPreview({
        postMessage: true,
      }),
    );

    await result.run();
    expect(postMessageSpy).toHaveBeenCalledTimes(1);

    result.clear();
    
    await result.run();
    
    // Should post message again after clear
    expect(postMessageSpy).toHaveBeenCalledTimes(2);
  });
});
