import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VideoPlayer from './VideoPlayer.vue';

vi.mock('video.js/dist/video-js.css', () => ({}));

vi.mock('@/composables/useSentryLogging', () => ({
  default: () => ({ logMediaEvent: vi.fn() }),
}));

const dispose = vi.fn();
const videojs = vi.fn((el) => {
  if (!el) throw new Error('Invalid target for videojs; must be a DOM node or string.');
  return { on: vi.fn(), dispose, log: vi.fn() };
});

vi.mock('video.js', () => ({ default: videojs }));

describe('VideoPlayer', () => {
  it('initializes and disposes the player when mounted normally', async () => {
    const wrapper = mount(VideoPlayer);
    await flushPromises();

    expect(videojs).toHaveBeenCalledTimes(1);

    wrapper.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('does not initialize video.js if unmounted while the library is loading', async () => {
    const wrapper = mount(VideoPlayer);

    wrapper.unmount();
    await flushPromises();

    expect(videojs).not.toHaveBeenCalled();
  });
});
