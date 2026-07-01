import { Tensor, InferenceSession, env } from 'onnxruntime-web';

let myOnnxSession;

async function loadModel() {
  // Adjust your environment settings as needed
  // env.wasm.numThreads = 4;
  env.wasm.simd = true; // Enable SIMD
  // env.wasm.wasmPaths
  myOnnxSession = await InferenceSession.create('./views/eyetracking_google.onnx', {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
}

// Immediately call loadModel when the worker starts
loadModel()
  .then(() => {
    console.log('Model loaded successfully');
  })
  .catch((err) => {
    console.error('Failed to load model:', err);
  });

onmessage = async function (e) {
  try {
    if (!myOnnxSession) {
      throw new Error('Model not initialized');
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
    console.error('[Worker]: Error processing message', error);
    // Consider posting back an error message or error code as needed
    postMessage({ error: error.message });
  }
};
