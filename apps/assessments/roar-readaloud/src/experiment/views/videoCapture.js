import store from 'store2';
import { uploadFile } from '@roar-platform/assessment-sdk/compat/firekit';
import { READALOUD_TASK_ID } from '@roar-platform/assessment-schema/roar-readaloud';

export var orig_img_width;
export var orig_img_height;

var desktop = document.documentElement;

export function openFullscreen() {
  if (desktop.requestFullscreen) {
    desktop.requestFullscreen();
  } else if (desktop.webkitRequestFullscreen) {
    /* Safari */
    desktop.webkitRequestFullscreen();
  } else if (desktop.msRequestFullscreen) {
    /* IE11 */
    desktop.msRequestFullscreen();
  }
}

export var countdown = 4;
export function updateCountdown(callbackFunction) {
  countdown--;

  if (countdown === 0) {
    document.getElementById('instruction').style.display = 'none';
    if (typeof callbackFunction === 'function') {
      callbackFunction();
      countdown = 4;
    }
  } else {
    document.getElementById('instruction').innerHTML = '<h1>' + countdown + '</h1>';
    setTimeout(function () {
      updateCountdown(callbackFunction);
    }, 1000);
  }
}

export async function giveAccess(audio = false) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60, max: 60 },
      },
      audio: audio,
    });

    // Assign the camera stream to the inputVideo element
    if (inputVideo) {
      inputVideo.srcObject = stream;
      inputVideo.play();
      inputVideo.addEventListener('loadedmetadata', function () {
        orig_img_width = inputVideo.videoWidth;
        orig_img_height = inputVideo.videoHeight;
        if (headCanvas) {
          headCanvas.width = orig_img_width;
          headCanvas.height = orig_img_height;
        }
      });
    }

    videoRecorder = new MediaRecorder(stream);
    videoRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        videoChunks.push(event.data);
      }
    };

    videoRecorder.onstop = async () => {
      console.log('Recording stopped, blob created');
    };
  } catch (error) {
    console.error('Error accessing media devices:', error);
  }
}

// Function to start audio and video recording
export async function startRecording() {
  videoChunks = []; // Clear previous video chunks
  // audioRecorder.start();
  if (videoRecorder && typeof videoRecorder.stop === 'function') {
    videoRecorder.stop();
  }
  if (videoRecorder && typeof videoRecorder.start === 'function') {
    videoRecorder.start();
  }
}

// Function to stop audio and video recording
export async function stopRecording() {
  if (videoRecorder && typeof videoRecorder.stop === 'function') {
    videoRecorder.stop();
  }
}

// Function to save recorded audio and video data
export async function saveRecordings({ filename, metadata = {} }) {
  await new Promise((resolve) => {
    videoRecorder.onstop = resolve;
    videoRecorder.stop();
  });

  const deviceConfig = store.session.get('deviceConfig') ?? defaultDeviceConfig;
  const mimeType = deviceConfig.storeVideo ? 'video/webm' : 'audio/webm';
  const mediaType = deviceConfig.storeVideo ? 'video' : 'audio';

  const mediaBlob = new Blob(videoChunks, { type: mimeType });

  if (mediaBlob.size > 0) {
    console.log(`${mediaType} recorded successfully. Size:`, mediaBlob.size, 'bytes');
  } else {
    console.error(`No ${mediaType} data recorded.`);
    return null;
  }

  return uploadRecording({ filename, fileOrBlob: mediaBlob, customMetadata: metadata });
}

/**
 * Uploads a recording via the assessment-sdk `uploadFile()` compat method and returns its
 * gs:// storage path, or null on failure.
 *
 * `uploadFile` resolves the storage bucket (the local Storage emulator in dev, the admin
 * recordings bucket in staging/prod), enqueues the resumable upload, and returns the storage
 * path immediately at enqueue — it sources runId/administrationId/participantId from the SDK
 * facade. We forward the session `id` as `assessmentPid` (the `<assessmentUid>_<participant>`
 * value configureDeviceView stores) so recordings keep the legacy storage-path convention
 * (`{taskId}/{participantId}/{assessmentPid}/…`) that downstream tooling expects, instead of
 * `pid` falling back to a duplicated participantId. A failed upload must not abort the
 * assessment, so the error is swallowed and null is returned (the caller's `recordAnswer`
 * already tolerates a null path, matching the legacy on-error behavior).
 *
 * @param {{ filename: string, fileOrBlob: Blob, customMetadata?: Record<string, string> }} recording
 * @returns {Promise<string|null>}
 */
async function uploadRecording({ filename, fileOrBlob, customMetadata }) {
  try {
    return await uploadFile({
      filename,
      fileOrBlob,
      taskId: READALOUD_TASK_ID,
      assessmentPid: store.session.get('id'),
      customMetadata,
    });
  } catch (err) {
    console.error('[roar-readaloud] recording upload failed:', err);
    return null; // trial continues; recordAnswer tolerates a null path
  }
}
