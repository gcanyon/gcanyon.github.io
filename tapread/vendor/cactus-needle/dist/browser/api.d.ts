/// <reference lib="esnext.disposable" />
import { JsonSchema } from "../schema.js";
import { InferSchema, StandardJsonSchema, ToolCollection } from "../tools.js";
import { ExtractOptions, Needle as Needle$1 } from "../types.js";
import { BrowserNeedleOptions, BrowserWhistleOptions } from "./types.js";
import { AudioSource, StreamOptions, TranscribeOptions, TranscriptionChunk, TranscriptionResult, Whistle as Whistle$1 } from "../speech.js";
//#region src/browser/api.d.ts
export type NeedleSettings<Tools extends ToolCollection = ToolCollection> = BrowserNeedleOptions<Tools> & {
  /** Python's weights argument. model remains an alias in browsers. */
  weights?: BrowserNeedleOptions['model'];
};
export type WhistleSettings = BrowserWhistleOptions & Pick<NeedleSettings, 'weights'>;
export type Needle<Tools extends ToolCollection = ToolCollection> = Needle$1<Tools>;
export type Whistle = Whistle$1;
export declare const Needle: {
  new <const Tools extends ToolCollection = ToolCollection>(options?: NeedleSettings<Tools>): Needle<Tools>;
};
export declare const Whistle: {
  new (options?: WhistleSettings): Whistle;
};
export declare const transcribe: (audio: AudioSource, options?: (TranscribeOptions & BrowserWhistleOptions & Pick<NeedleSettings<ToolCollection>, "weights">) | undefined) => Promise<TranscriptionResult>, stream: (chunks: AsyncIterable<Float32Array> | Iterable<Float32Array>, options?: (StreamOptions & BrowserWhistleOptions & Pick<NeedleSettings<ToolCollection>, "weights">) | undefined) => AsyncIterableIterator<TranscriptionChunk>, extract: <const Schema extends JsonSchema | StandardJsonSchema>(input: string, schema: Schema, options?: (ExtractOptions & BrowserNeedleOptions<ToolCollection> & {
  /** Python's weights argument. model remains an alias in browsers. */
  weights?: BrowserNeedleOptions["model"];
}) | undefined) => Promise<InferSchema<Schema> | null>, close: () => Promise<void>;
//#endregion
//# sourceMappingURL=api.d.ts.map