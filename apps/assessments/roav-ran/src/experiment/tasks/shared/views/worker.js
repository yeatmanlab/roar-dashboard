import { Tensor, InferenceSession, env } from "onnxruntime-web";

let myOnnxSession;

async function loadModel() {
  // Adjust your environment settings as needed
  // env.wasm.numThreads = 4;

  // Only enable SIMD if supported
  if (typeof WebAssembly.validate === "function") {
    // SIMD detection via feature test using a minimal WebAssembly module
    // This module contains a v128.const instruction (0xfd 0x0f) followed by
    // a i8x16.splat instruction (0xfd 0x62), which are SIMD-specific opcodes.
    // If the browser supports SIMD, validate() returns true; otherwise false.
    const simdSupported = WebAssembly.validate(
      new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60,
        0x00, 0x01, 0x7b, 0x03, 0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00,
        0x41, 0x00, 0xfd, 0x0f, 0xfd, 0x62, 0x0b,
      ]),
    );
    env.wasm.simd = simdSupported;
  } else {
    env.wasm.simd = false;
  }

  // env.wasm.wasmPaths
  myOnnxSession = await InferenceSession.create(
    "tasks/shared/eyetracking_google.onnx",
    {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    },
  );
}

// Immediately call loadModel when the worker starts
loadModel()
  .then(() => {
    console.log("Model loaded successfully");
  })
  .catch((err) => {
    console.error("Failed to load model:", err);
  });

onmessage = async function (e) {
  try {
    if (!myOnnxSession) {
      throw new Error("Model not initialized");
    }

    let input1, input2, kpsTensor;

    input1 = new Tensor("float32", e.data.input1.data, [1, 3, 128, 128]);
    input2 = new Tensor("float32", e.data.input2.data, [1, 3, 128, 128]);
    kpsTensor = new Tensor("float32", e.data.kpsTensor.data, [1, 8]);

    const result = await myOnnxSession.run({
      input1: input1,
      input2: input2,
      kps: kpsTensor,
    });
    postMessage(result);
  } catch (error) {
    console.error("[Worker]: Error processing message", error);
    // Consider posting back an error message or error code as needed
    postMessage({ error: error.message });
  }
};
