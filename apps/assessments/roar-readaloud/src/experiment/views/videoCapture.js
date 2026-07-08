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
export async function saveRecordings({ filename, config, metadata = {} }) {
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

  return uploadRecording({ filename, fileOrBlob: mediaBlob, customMetadata: metadata, config });
}

/**
 * Uploads a recording to storage and returns its gs:// storage path (or null).
 *
 * TODO: wire to the assessment-sdk `uploadFile()` compat method — deferred to the follow-up
 * readaloud upload-SDK PR to keep this migration PR scoped and firekit-free. `uploadFile()`
 * already exists in the SDK (it resolves the storage bucket — emulator in dev, admin bucket
 * in staging/prod — fires the resumable upload, and returns the storage path); there this seam
 * becomes `return uploadFile({ filename, fileOrBlob, taskId: READALOUD_TASK_ID, ... })`.
 * Until then it is a no-op, so trials complete without uploads (null matches the pre-existing
 * on-error return the caller already handles).
 *
 * @param {{ filename: string, fileOrBlob: Blob, customMetadata?: object, config?: object }} recording
 * @returns {Promise<string|null>}
 */
async function uploadRecording(recording) {
  void recording;
  return null;
}
