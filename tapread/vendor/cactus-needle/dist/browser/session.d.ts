/// <reference lib="esnext.disposable" />
import { ToolCollection } from "../tools.js";
import { Needle } from "../types.js";
import { BrowserNeedleOptions, BrowserWhistleOptions } from "./types.js";
import { Whistle } from "../speech.js";
//#region src/browser/session.d.ts
/** Load a local browser session. Only setup fetches assets; inference stays in the worker. */
export declare function createNeedle<const Tools extends ToolCollection = ToolCollection>(options?: BrowserNeedleOptions<Tools>): Promise<Needle<Tools>>;
/** Load and cache Whistle separately from the text model. Reuse this session for each recording. */
export declare function createWhistle(options?: BrowserWhistleOptions): Promise<Whistle>;
//#endregion
//# sourceMappingURL=session.d.ts.map