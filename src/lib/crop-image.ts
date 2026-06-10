const MAX_CANVAS_EDGE = 4096; // browser-safe canvas cap — larger canvases crash tabs
const MAX_OUTPUT_EDGE = 1600; // 2× the 800px duel card: retina headroom, sane file size
const MIN_OUTPUT_EDGE = 1;
const STEP_DOWN_FACTOR = 2; // halve per pass — a single >50% reduction blurs badly
const WEBP_OUTPUT_QUALITY = 0.9;
const OUTPUT_MIME = "image/webp";

export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Final square edge: the crop's native size, capped for canvas/file sanity. */
export function outputEdgeFor(cropEdge: number): number {
  return Math.max(MIN_OUTPUT_EDGE, Math.min(Math.round(cropEdge), MAX_OUTPUT_EDGE));
}

/**
 * Intermediate edges for quality-preserving step-down scaling: halve from the
 * (canvas-capped) source edge until ONE final draw to `targetEdge` reduces by
 * at most STEP_DOWN_FACTOR. Returns [] when the source is already close enough.
 */
export function stepDownEdges(sourceEdge: number, targetEdge: number): number[] {
  const edges: number[] = [];
  let edge = Math.min(sourceEdge, MAX_CANVAS_EDGE);
  while (edge / STEP_DOWN_FACTOR > targetEdge) {
    edge = Math.ceil(edge / STEP_DOWN_FACTOR);
    edges.push(edge);
  }
  return edges;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the image"));
    image.src = url;
  });
}

function makeCanvas(edge: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      OUTPUT_MIME,
      WEBP_OUTPUT_QUALITY,
    );
  });
}

/**
 * Render the selected square region of `file` to a WebP File, step-down scaled
 * to at most MAX_OUTPUT_EDGE. The browser decodes with EXIF orientation baked
 * in, so the output needs no further rotation server-side.
 */
export async function cropImageToFile(file: File, area: CropAreaPixels): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const cropEdge = Math.min(area.width, area.height);
    const targetEdge = outputEdgeFor(cropEdge);

    // Pass 1: extract the crop region (capped to the browser-safe canvas edge).
    const firstEdge = Math.max(targetEdge, Math.min(Math.round(cropEdge), MAX_CANVAS_EDGE));
    let current = makeCanvas(firstEdge);
    current.ctx.drawImage(
      image,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      firstEdge,
      firstEdge,
    );

    // Step-down passes, then one final draw to the exact target edge.
    for (const edge of stepDownEdges(firstEdge, targetEdge)) {
      const next = makeCanvas(edge);
      next.ctx.drawImage(current.canvas, 0, 0, edge, edge);
      current = next;
    }
    if (current.canvas.width !== targetEdge) {
      const final = makeCanvas(targetEdge);
      final.ctx.drawImage(current.canvas, 0, 0, targetEdge, targetEdge);
      current = final;
    }

    const blob = await canvasToBlob(current.canvas);
    const stem = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${stem}.webp`, {
      type: OUTPUT_MIME,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
