/**
 * @fileoverview Web Worker for ONNX model inference.
 * @module onnxWorker
 */
// The model is emitted to `dist/et/eyetracking_google.onnx` by the build's copy step
// (rollup-plugin-copy / CopyWebpackPlugin) and fetched at runtime from the absolute path
// below — not imported here, so both bundlers can process this worker identically.
import { Tensor, InferenceSession, env } from 'onnxruntime-web';

/** @type {InferenceSession} The ONNX inference session */
let myOnnxSession;

/**
 * Loads the ONNX model.
 * @async
 * @function
 * @returns {Promise<void>}
 */
async function loadModel() {
  // Adjust your environment settings as needed
  // env.wasm.numThreads = 4;
  env.wasm.simd = true; // Enable SIMD
  // env.wasm.wasmPaths
  /*
  myOnnxSession = await InferenceSession.create(
    // "./views/eyetracking_google.onnx",                   // @TM
    new URL('./eyetracking_google.onnx', import.meta.url),  // @TM
    {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    },
  );
  */
  myOnnxSession = await InferenceSession.create('/et/eyetracking_google.onnx', {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
}

// Model loading...
loadModel()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Model loaded successfully');
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to load model:', err);
  });

/**
 * Handles messages received by the web worker.
 * @function
 * @param {MessageEvent} e - The message event.
 * @listens onmessage
 */
onmessage = async function (e) {
  try {
    // TODO: see if this is correct fix
    // if (!myOnnxSession) {
    //   throw new Error("Model not initialized");
    // }

    if (!myOnnxSession) {
      await loadModel();
    }

    const input1 = new Tensor('float32', e.data.input1.data, [1, 3, 128, 128]);
    const input2 = new Tensor('float32', e.data.input2.data, [1, 3, 128, 128]);
    const kpsTensor = new Tensor('float32', e.data.kpsTensor.data, [1, 8]);

    const result = await myOnnxSession.run({
      input1: input1,
      input2: input2,
      kps: kpsTensor,
    });
    postMessage(result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Worker]: Error processing message', error);
    // Consider posting back an error message or error code as needed
    postMessage({ error: error.message });
  }
};
