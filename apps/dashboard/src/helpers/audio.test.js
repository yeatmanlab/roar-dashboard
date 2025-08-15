import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BufferLoader } from './audio';

describe('audio', () => {
  global.XMLHttpRequest = vi.fn(() => ({
    open: vi.fn(),
    send: vi.fn(),
    responseType: '',
    onload: vi.fn(),
    onerror: vi.fn(),
  }));

  global.alert = vi.fn();

  global.console.error = vi.fn();

  const mockDecodeAudioData = vi.fn();
  const mockContext = {
    decodeAudioData: mockDecodeAudioData,
  };

  let bufferLoader;
  const mockCallback = vi.fn();
  const mockUrlListMap = { 0: 'test1.mp3', 1: 'test2.mp3' };

  beforeEach(() => {
    vi.resetAllMocks();
    bufferLoader = new BufferLoader(mockContext, mockUrlListMap, mockCallback);
    global.XMLHttpRequest.mockClear();
    global.XMLHttpRequest.mockImplementation(() => ({
      open: vi.fn(),
      send: vi.fn(),
      responseType: '',
      onload: null,
      onerror: null,
    }));
  });

  describe('BufferLoader', () => {
    it('should create a BufferLoader instance with correct properties', () => {
      expect(bufferLoader.context).toBe(mockContext);
      expect(bufferLoader.urlListMap).toBe(mockUrlListMap);
      expect(bufferLoader.onload).toBe(mockCallback);
      expect(bufferLoader.bufferList).toEqual([]);
      expect(bufferLoader.loadCount).toBe(0);
    });

    it('should call XMLHttpRequest.open and send when loadBuffer is called', () => {
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        responseType: '',
      };
      global.XMLHttpRequest.mockImplementationOnce(() => mockXHR);

      bufferLoader.loadBuffer('test.mp3', 0);

      expect(mockXHR.open).toHaveBeenCalledWith('GET', 'test.mp3', true);
      expect(mockXHR.responseType).toBe('arraybuffer');
      expect(mockXHR.send).toHaveBeenCalled();
    });

    it('should call context.decodeAudioData when request.onload is triggered', () => {
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        responseType: '',
        response: 'mock-response',
      };
      global.XMLHttpRequest.mockImplementationOnce(() => mockXHR);

      bufferLoader.loadBuffer('test.mp3', 0);

      mockXHR.onload && mockXHR.onload();

      expect(mockContext.decodeAudioData).toHaveBeenCalledWith(
        'mock-response',
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('should call load for all items in urlListMap', () => {
      const loadBufferSpy = vi.spyOn(bufferLoader, 'loadBuffer');

      bufferLoader.load();

      expect(loadBufferSpy).toHaveBeenCalledTimes(2);
      expect(loadBufferSpy).toHaveBeenCalledWith('test1.mp3', '0');
      expect(loadBufferSpy).toHaveBeenCalledWith('test2.mp3', '1');
    });
  });

  describe('AudioContext', () => {
    it('should use window.AudioContext or window.webkitAudioContext', () => {
      const getAudioContext = () => window.AudioContext || window.webkitAudioContext;

      global.window = {
        AudioContext: 'MockAudioContext',
        webkitAudioContext: undefined,
      };
      expect(getAudioContext()).toBe('MockAudioContext');

      global.window = {
        AudioContext: undefined,
        webkitAudioContext: 'MockWebkitAudioContext',
      };
      expect(getAudioContext()).toBe('MockWebkitAudioContext');
    });
  });
});
