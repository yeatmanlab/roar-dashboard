<template>
  <div>
    <video ref="videoPlayerRef" class="video-js"></video>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player'; // Import the Player type
import 'video.js/dist/video-js.css';

// Define Props
interface Props {
  options?: object; // Use generic object for now
  onVideoStart?: (taskId: string | null) => void;
  onVideoEnd?: (taskId: string | null) => void;
  taskId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({}), // Default to empty options object
  onVideoStart: (taskId: string | null) => console.log('videoStarted', taskId),
  onVideoEnd: (taskId: string | null) => console.log('videoEnded', taskId),
  taskId: null,
});

// Refs
const videoPlayerRef: Ref<HTMLVideoElement | null> = ref(null);
const player: Ref<Player | null> = ref(null);

// Lifecycle Hooks
onMounted(() => {
  if (videoPlayerRef.value) {
    player.value = videojs(videoPlayerRef.value, props.options, () => {
      // Use optional chaining in case player.value is null, though unlikely here
      player.value?.log('onPlayerReady', this);
    });

    // Event Listeners
    player.value?.on('play', () => {
      if (props.onVideoStart) {
        props.onVideoStart(props.taskId);
      }
    });

    player.value?.on('ended', () => {
      if (props.onVideoEnd) {
        props.onVideoEnd(props.taskId);
      }
    });
  }
});

onBeforeUnmount(() => {
  if (player.value) {
    player.value.dispose();
  }
});

</script>
