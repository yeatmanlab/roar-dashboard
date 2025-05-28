<template>
  <div>
    <video ref="videoPlayer" class="video-js"></video>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import "video.js/dist/video-js.css";

interface Props {
  options?: Record<string, any>;
  onVideoStart?: (taskId: string | null) => void;
  onVideoEnd?: (taskId: string | null) => void;
  taskId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({}),
  onVideoStart: (taskId: string | null) => {
    console.log("videoStarted", taskId);
  },
  onVideoEnd: (taskId: string | null) => {
    console.log("videoEnded", taskId);
  },
  taskId: null,
});

const videoPlayer = ref<HTMLVideoElement>();
const player = ref<any>(null);

onMounted(async (): Promise<void> => {
  const videojs = (await import("video.js")).default;
  if (videoPlayer.value) {
    player.value = videojs(videoPlayer.value, props.options, () => {
      player.value.log("onPlayerReady", player.value);
    });

    // Attach a listener to use callback function onVideoEnd when user finishes starting video
    // Note: This method does not confirm that the user has watched the whole video,
    // only that the video has ended.
    player.value.on("play", () => props.onVideoStart(props.taskId));

    // Attach a listener to use callback function onVideoEnd when user finishes watching video
    // Note: This method does not confirm that the user has watched the whole video,
    // only that the video has ended.
    player.value.on("ended", () => props.onVideoEnd(props.taskId));
  }
});

onBeforeUnmount((): void => {
  if (player.value) {
    player.value.dispose();
  }
});
</script>
