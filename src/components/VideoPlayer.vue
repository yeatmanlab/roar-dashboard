<template>
  <div>
    <video ref="videoPlayer" class="video-js"></video>
  </div>
</template>

<script>
import 'video.js/dist/video-js.css';

export default {
  name: 'VideoPlayer',
  props: {
    options: {
      type: Object,
      default() {
        return {};
      },
    },
    onVideoStart: {
      type: Function,
      default(taskId) {
        console.log('videoStarted', taskId);
      },
    },
    onVideoEnd: {
      type: Function,
      default(taskId) {
        console.log('videoEnded', taskId);
      },
    },
    taskId: {
      type: String,
      default: null,
    },
  },
  data() {
    return {
      player: null,
    };
  },
  mounted: async function () {
    const videojs = (await import('video.js')).default;
    this.player = videojs(this.$refs.videoPlayer, this.options, () => {
      this.player.log('onPlayerReady', this);
    });

    // Attach a listener to use callback function onVideoEnd when user finishes starting video
    // Note: This method does not confirm that the user has watched the whole video,
    // only that the video has ended.
    this.player.on('play', () => this.onVideoStart(this.taskId));

    // Attach a listener to use callback function onVideoEnd when user finishes watching video
    // Note: This method does not confirm that the user has watched the whole video,
    // only that the video has ended.
    this.player.on('ended', () => this.onVideoEnd(this.taskId));
  },
  beforeUnmount() {
    if (this.player) {
      this.player.dispose();
    }
  },
};
</script>
