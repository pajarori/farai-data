import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
export const EMBEDDING_DIM = 384;
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";
const MAX_INPUT_CHARS = 2048;

let loader: Promise<FeatureExtractionPipeline | undefined> | undefined;

function loadPipeline(): Promise<FeatureExtractionPipeline | undefined> {
  if (!loader) {
    loader = (async () => {
      try {
        const modelDir = process.env.FARAI_EMBED_MODEL_DIR?.trim();
        if (modelDir) {
          env.localModelPath = modelDir;
          env.allowRemoteModels = false;
        } else if (process.env.FARAI_EMBED_OFFLINE === "1") {
          env.allowRemoteModels = false;
        }
        return await pipeline("feature-extraction", EMBEDDING_MODEL);
      } catch {
        return undefined;
      }
    })();
  }
  return loader;
}

async function embed(text: string): Promise<Float32Array | undefined> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  const extractor = await loadPipeline();
  if (!extractor) return undefined;
  try {
    const output = await extractor(clean.slice(0, MAX_INPUT_CHARS), { pooling: "mean", normalize: true });
    return Float32Array.from(output.data as Float32Array);
  } catch {
    return undefined;
  }
}

export function embedPassage(text: string): Promise<Float32Array | undefined> {
  return embed(text);
}

export function embedQuery(text: string): Promise<Float32Array | undefined> {
  return embed(QUERY_PREFIX + text);
}

export async function embeddingAvailable(): Promise<boolean> {
  return Boolean(await loadPipeline());
}

export function encodeVector(vector: Float32Array): Uint8Array {
  return new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
}
