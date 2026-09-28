/**
 * @fileoverview Web Worker for ONNX model inference.
 * @module onnxWorker
 */
// import "./eyetracking_google.onnx"; // @ONNX-FIX
import { Tensor, InferenceSession, env } from "onnxruntime-web";
import modelUrl from "./eyetracking_google.onnx";

// The ONNX inference session
let myOnnxSession;

async function loadModel() {
  // @THINK: adjust your environment settings as needed
  // env.wasm.numThreads = 4;
  env.wasm.simd = true; // Enable SIMD

  myOnnxSession = await InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
}

loadModel()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Model loaded successfully");
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load model:", err);
  });

onmessage = async function (e) {
  try {
    if (!myOnnxSession) {
      await loadModel();
    }

    const input1 = new Tensor("float32", e.data.input1.data, [1, 3, 128, 128]);
    const input2 = new Tensor("float32", e.data.input2.data, [1, 3, 128, 128]);
    const kpsTensor = new Tensor("float32", e.data.kpsTensor.data, [1, 8]);

    const result = await myOnnxSession.run({
      input1: input1,
      input2: input2,
      kps: kpsTensor,
    });
    postMessage(result);
    input1.dispose();
    input2.dispose();
    kpsTensor.dispose();
    if (result) {
      Object.values(result).forEach((t) => {
        if (t && t.dispose) t.dispose();
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Worker]: Error processing message", error);
    postMessage({ error: error.message });
  }
};
