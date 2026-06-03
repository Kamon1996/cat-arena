import type { Buffer } from "node:buffer";
import * as tf from "@tensorflow/tfjs-node";
import * as nsfwjs from "nsfwjs";

// Cache the loaded model (immutable weights — safe to memoize per process).
let modelPromise: Promise<nsfwjs.NSFWJS> | null = null;

function loadModel(): Promise<nsfwjs.NSFWJS> {
  modelPromise ??= nsfwjs.load();
  return modelPromise;
}

const UNSAFE_CLASSES = new Set(["Porn", "Hentai", "Sexy"]);

/**
 * Local NSFWJS classification fallback. Returns the probability that the
 * image is unsafe (max of the unsafe class scores), in [0, 1].
 */
export async function nsfwFallbackScore(image: Buffer): Promise<number> {
  const model = await loadModel();
  const decoded = tf.node.decodeImage(image, 3) as tf.Tensor3D;
  try {
    const predictions = await model.classify(decoded);
    let unsafe = 0;
    for (const p of predictions) {
      if (UNSAFE_CLASSES.has(p.className) && p.probability > unsafe) {
        unsafe = p.probability;
      }
    }
    return unsafe;
  } finally {
    decoded.dispose();
  }
}
