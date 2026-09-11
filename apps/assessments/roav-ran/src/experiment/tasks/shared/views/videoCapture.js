/**
 * @fileoverview
 * This module provides utilities for video capture, recording, and uploading.
 * It includes functions for fullscreen mode, countdown, camera access,
 * video recording, and file uploading to a cloud storage service.
 *
 * @module videoCapture
 */

import { uploadFile } from '@roar-platform/assessment-sdk/compat/firekit';

/** @type {number} Original image width */
export var orig_img_width;
/** @type {number} Original image height */
export var orig_img_height;

var desktop = document.documentElement;
var mediaStream; // Store the media stream
var recordingParams = {}; // Store bEyeTracking, storeVideo

/**
 * Opens the browser in fullscreen mode.
 * @function
 */
export function openFullscreen() {
  try {
    if (desktop.requestFullscreen) {
      desktop.requestFullscreen().catch(() => {});
    } else if (desktop.webkitRequestFullscreen) {
      /* Safari */
      desktop.webkitRequestFullscreen();
    } else if (desktop.msRequestFullscreen) {
      /* IE11 */
      desktop.msRequestFullscreen();
    }
  } catch (e) {
    // Fullscreen not supported or denied (e.g. Firefox on iOS) — continue without it
  }
}

/** @type {number} Countdown value */
export var countdown = 4;

/**
 * Updates the countdown and executes a callback when it reaches zero.
 * @function
 * @param {Function} callbackFunction - Function to call when countdown reaches zero.
 */
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

/**
 * Detects supported MIME type for MediaRecorder.
 * @function
 * @param {string} type - Type of media ('video' or 'audio').
 * @returns {string|null} Supported MIME type or null if none found.
 */
function getSupportedMimeType(type) {
  const types =
    type === 'video'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];

  for (const mimeType of types) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return null;
}

/**
 * Requests access to the user's camera and/or microphone based on parameters.
 * @async
 * @function
 * @param {boolean} bEyeTracking - Whether eye tracking is enabled (requires video).
 * @param {boolean} storeVideo - Whether to store video in the recording.
 * @returns {Promise<{success: boolean}>} Returns an object indicating success.
 * @throws {Error} Throws error if media access fails or MIME types are unsupported.
 */
export async function giveAccess(bEyeTracking = false, storeVideo = false) {
  try {
    // Stop any existing streams before requesting new access to avoid leaking tracks.
    // Any brief audio session disruption from stopping old tracks is hidden inside
    // the getUserMedia await below, so the session is fully stable on return.
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    if (window.micStream && window.micStream.getTracks) {
      window.micStream.getTracks().forEach((track) => track.stop());
      window.micStream = null;
    }

    // Determine media constraints based on parameters
    const mediaConstraints = {};

    // Request video if eye tracking is enabled OR if we need to store video
    if (bEyeTracking || storeVideo) {
      mediaConstraints.video = {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 15 },
      };
    }

    // Request audio
    mediaConstraints.audio = true;

    // console.log("Media constraints:", mediaConstraints);
    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

    // Store the stream and recording parameters for later use
    mediaStream = stream;
    recordingParams = { bEyeTracking, storeVideo };

    // Assign the camera stream to the inputVideo element if video is requested
    if ((bEyeTracking || storeVideo) && inputVideo) {
      inputVideo.srcObject = stream;
      inputVideo.muted = true; // Mute the video element to prevent audio playback
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

    return { success: true };
  } catch (error) {
    console.error('Error accessing media devices:', error);
    throw error; // Re-throw so caller can handle
  }
}

/**
 * Parses metadata to convert number words to digits.
 * @function
 * @param {Object} metadata - The metadata object to parse.
 * @returns {Object} The parsed metadata object.
 */
function parseMetadata(metadata) {
  const numberWords = {
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
  };

  const parsedMetadata = { ...metadata };

  if (Array.isArray(parsedMetadata.stimulus)) {
    parsedMetadata.stimulus = parsedMetadata.stimulus.reduce((accumulator, currentValue) => {
      const converted = numberWords[currentValue.toLowerCase()] || currentValue;
      return accumulator + converted;
    }, '');
  }

  return { stimImages: parsedMetadata.stimulus, ...parsedMetadata };
}

/**
 * Starts media recording.
 * @async
 * @function
 * @returns {Promise<void>}
 */
export async function startRecording() {
  mediaChunks = []; // Clear previous media chunks

  // Stop existing recorder if running
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }

  // Create the appropriate recorder based on what should be uploaded
  let recordStream;
  let mimeType;

  try {
    if (recordingParams.storeVideo) {
      // Scenario 3: Record and upload video (with audio if available)
      recordStream = mediaStream;
      mimeType = getSupportedMimeType('video');
      if (!mimeType) {
        throw new Error('No supported video MIME type found for MediaRecorder');
      }
    } else {
      // Scenarios 1 & 2: Record and upload audio only
      // Extract only audio tracks from the stream
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        recordStream = new MediaStream(audioTracks);
        mimeType = getSupportedMimeType('audio');
        if (!mimeType) {
          throw new Error('No supported audio MIME type found for MediaRecorder');
        }
      } else {
        console.error('No audio tracks available for recording');
        return;
      }
    }
  } catch (error) {
    console.error('Error setting up recording stream:', error);
    return;
  }

  // Create the MediaRecorder with the appropriate stream
  // console.log("MIME Type:", mimeType);
  mediaRecorder = new MediaRecorder(recordStream, {
    mimeType,
    videoBitsPerSecond: 128000, // set video sampling rate to 2.5 Mbps (Chrome defaults)
    audioBitsPerSecond: 128000, // set audio sampling rate to 128 kbps (Chrome defaults)
  });

  // console.log('mediaRecorder:', mediaRecorder);

  mediaRecorder.ondataavailable = (event) => {
    console.log('Media chunk size:', event.data.size);
    if (event.data.size > 0) {
      mediaChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    console.log('Recording stopped, blob created');
  };

  mediaRecorder.start();
}

/**
 * Stops media recording.
 * @async
 * @function
 * @returns {Promise<void>}
 */
export async function stopRecording() {
  // Wait for the recorder to stop and fire its onstop event
  // This ensures all data chunks are collected
  try {
    await new Promise((resolve) => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.onstop = resolve;
        mediaRecorder.stop();
      } else {
        resolve();
      }
    });
  } catch (error) {
    console.error('Error stopping media recorder:', error);
  }
}

/**
 * Saves the recorded media.
 * @async
 * @function
 * @param {string} filename - Name of the file to save.
 * @param {Object} deviceConfig - Device configuration object.
 * @param {Object} config - Configuration object.
 * @param {Object} metadata - Metadata object.
 * @returns {string} - upload URL
 */
export async function saveRecordings({ filename, deviceConfig, config, metadata }) {
  // Recorder should already be stopped by stopRecording()
  // Data chunks should be available now

  // console.log("media chunks", mediaChunks);

  // The MIME type was already set correctly when the recorder was created in startRecording()
  // Scenario 1: bEyeTracking=false, storeVideo=false -> audio/webm
  // Scenario 2: bEyeTracking=true, storeVideo=false  -> audio/webm (video stream used for eye tracking, but only audio recorded)
  // Scenario 3: bEyeTracking=true, storeVideo=true   -> video/webm

  // Determine MIME type based on what was actually recorded
  let mimeType;
  if (deviceConfig.storeVideo) {
    mimeType = 'video/webm';
  } else {
    mimeType = 'audio/webm';
  }

  const mediaBlob = new Blob(mediaChunks, { type: mimeType });

  if (mediaBlob.size > 0) {
    console.log('Media recorded successfully. Size:', mediaBlob.size, 'bytes');
  } else {
    console.error('No media data recorded.');
    return null;
  }

  try {
    // console.log("Uploading file:", filename);

    return await uploadFile({
      filename,
      fileOrBlob: mediaBlob,
      taskId: config.task,
      assessmentPid: store.session.get('id'),
      customMetadata: parseMetadata(metadata),
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    return null;
  }
}

export function stopMediaStreams() {
  // Stop the stored media stream
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => {
      track.stop();
    });
    mediaStream = null;
  }

  // Also clear any streams on video elements
  const inputVideo = document.getElementsByClassName('inputVideo')[0];
  if (inputVideo) {
    if (inputVideo.srcObject) {
      const tracks = inputVideo.srcObject.getTracks();
      tracks.forEach((track) => {
        track.stop();
      });
      inputVideo.srcObject = null;
    }
  }

  if (window.mediaRecorder && window.mediaRecorder.state !== 'inactive') {
    window.mediaRecorder.stop();
    window.mediaRecorder = null;
  }

  if (window.micStream && window.micStream.getTracks) {
    window.micStream.getTracks().forEach((track) => track.stop());
    window.micStream = null;
  }
}
