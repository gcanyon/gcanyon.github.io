/// <reference lib="esnext.disposable" />
import { JsonSchema, JsonValue, ToolDefinition, ToolSchema } from "../schema.js";
import { StandardJsonSchema, Tool, ToolCall, ToolCollection, ToolSet, tool } from "../tools.js";
import { CompletionOptions, CompletionResult, EmbedOptions, ExtractOptions, FunctionCall, GenerateOptions, GenerateResult, RunOptions, RunResult } from "../types.js";
import { BrowserNeedleOptions, BrowserWhistleOptions, DownloadProgress } from "./types.js";
import { AudioInput, AudioSource, PcmAudio, SpeechLanguage, StreamOptions, TranscribeOptions, TranscriptWord, TranscriptionChunk, TranscriptionResult, TranscriptionSettings } from "../speech.js";
import { ExtractionValidationError, NeedleError, NeedleErrorCode } from "../errors.js";
import { DEFAULT_MODEL, DEFAULT_SPEECH_MODEL } from "../runtime/artifacts.js";
import { Needle, NeedleSettings, Whistle, WhistleSettings, close, extract, stream, transcribe } from "./api.js";
import { createNeedle, createWhistle } from "./session.js";
export { type AudioInput, type AudioSource, type BrowserNeedleOptions, type BrowserWhistleOptions, type CompletionOptions, type CompletionResult, DEFAULT_MODEL, DEFAULT_SPEECH_MODEL, type DownloadProgress, type EmbedOptions, type ExtractOptions, ExtractionValidationError, type FunctionCall, type GenerateOptions, type GenerateResult, type JsonSchema, type JsonValue, Needle, NeedleError, type NeedleErrorCode, type NeedleSettings, type PcmAudio, type RunOptions, type RunResult, type SpeechLanguage, type StandardJsonSchema, type StreamOptions, type Tool, type ToolCall, type ToolCollection, type ToolDefinition, type ToolSchema, type ToolSet, type TranscribeOptions, type TranscriptWord, type TranscriptionChunk, type TranscriptionResult, type TranscriptionSettings, Whistle, type WhistleSettings, close, createNeedle, createWhistle, extract, stream, tool, transcribe };