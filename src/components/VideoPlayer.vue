<template>
  <div>
    <video ref="videoPlayer" class="video-js"></video>
  </div>
</template>

<<<<<<< HEAD
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import 'video.js/dist/video-js.css';

interface Props {
  options?: Record<string, any>;
  onVideoStart?: (taskId: string | null) => void;
  onVideoEnd?: (taskId: string | null) => void;
  taskId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({}),
  onVideoStart: (taskId: string | null) => {
    console.log('videoStarted', taskId);
=======
<script>
import "video.js/dist/video-js.css";

export default {
  name: "VideoPlayer",
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
        console.log("videoStarted", taskId);
      },
    },
    onVideoEnd: {
      type: Function,
      default(taskId) {
        console.log("videoEnded", taskId);
      },
    },
    taskId: {
      type: String,
      default: null,
    },
>>>>>>> origin/main
  },
  onVideoEnd: (taskId: string | null) => {
    console.log('videoEnded', taskId);
  },
<<<<<<< HEAD
  taskId: null,
});

const videoPlayer = ref<HTMLVideoElement>();
const player = ref<any>(null);

onMounted(async (): Promise<void> => {
  const videojs = (await import('video.js')).default;
  if (videoPlayer.value) {
    player.value = videojs(videoPlayer.value, props.options, () => {
      player.value.log('onPlayerReady', player.value);
=======
  mounted: async function () {
    const videojs = (await import("video.js")).default;
    this.player = videojs(this.$refs.videoPlayer, this.options, () => {
      this.player.log("onPlayerReady", this);
>>>>>>> origin/main
    });

    // Attach a listener to use callback function onVideoEnd when user finishes starting video
    // Note: This method does not confirm that the user has watched the whole video,
    // only that the video has ended.
<<<<<<< HEAD
    player.value.on('play', () => props.onVideoStart(props.taskId));
=======
    this.player.on("play", () => this.onVideoStart(this.taskId));
>>>>>>> origin/main

    // Attach a listener to use callback function onVideoEnd when user finishes watching video
    // Note: This method does not confirm that the user has watched the whole video,
    // only that the video has ended.
<<<<<<< HEAD
    player.value.on('ended', () => props.onVideoEnd(props.taskId));
  }
});

onBeforeUnmount((): void => {
  if (player.value) {
    player.value.dispose();
  }
});
=======
    this.player.on("ended", () => this.onVideoEnd(this.taskId));
  },
  beforeUnmount() {
    if (this.player) {
      this.player.dispose();
    }
  },
};
>>>>>>> origin/main
</script>
