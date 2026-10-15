/// <reference lib="esnext.disposable" />
import { JsonSchema, JsonValue, ToolDefinition } from "./schema.js";
//#region src/tools.d.ts
/** Structural subset of Standard JSON Schema V1; supported by Zod 4.2+ and other schema libraries. */
export interface StandardJsonSchema<Input = unknown> {
  readonly '~standard': {
    readonly version: 1;
    readonly types?: {
      readonly input: Input;
      readonly output: unknown;
    } | undefined;
    readonly jsonSchema: {
      readonly input: (options: {
        readonly target: 'draft-07';
      }) => Record<string, unknown>;
    };
    readonly validate?: (value: unknown) => {
      readonly issues?: readonly unknown[] | undefined;
      readonly value?: unknown;
    } | Promise<{
      readonly issues?: readonly unknown[] | undefined;
      readonly value?: unknown;
    }>;
  };
}
declare const inputType: unique symbol;
export interface Tool<Input = unknown> {
  readonly description?: string;
  readonly inputSchema: JsonSchema;
  readonly triggers?: readonly string[];
  /** Used only by Needle.run(); complete() and generate() never execute tools. */
  execute?(input: Input, context: {
    abortSignal: AbortSignal;
  }): unknown | Promise<unknown>;
  readonly [inputType]?: Input;
}
export type ToolSet = Readonly<Record<string, Tool>>;
export type ToolCollection = ToolSet | readonly ToolDefinition[];
type RequiredKeys<S> = S extends {
  readonly required: readonly (infer K)[];
} ? Extract<K, string> : never;
type SchemaType<S, Depth extends unknown[] = []> = Depth['length'] extends 8 ? unknown : S extends {
  readonly $ref: string;
} ? unknown : S extends {
  readonly const: infer Value;
} ? Value : S extends {
  readonly enum: readonly (infer Value)[];
} ? Value : S extends {
  readonly type: 'string';
} ? string : S extends {
  readonly type: 'number' | 'integer';
} ? number : S extends {
  readonly type: 'boolean';
} ? boolean : S extends {
  readonly type: 'null';
} ? null : S extends {
  readonly type: 'array';
  readonly items: infer Item;
} ? SchemaType<Item, [...Depth, 0]>[] : S extends {
  readonly type: 'object';
  readonly properties: infer Properties;
} ? { -readonly [K in keyof Properties as K extends RequiredKeys<S> ? K : never]-?: SchemaType<Properties[K], [...Depth, 0]>; } & { -readonly [K in keyof Properties as K extends RequiredKeys<S> ? never : K]?: SchemaType<Properties[K], [...Depth, 0]>; } : unknown;
export type InferSchema<S> = S extends StandardJsonSchema ? NonNullable<S['~standard']['types']>['input'] : SchemaType<S>;
interface ToolOptions<Schema> {
  description?: string;
  inputSchema: Schema;
  triggers?: readonly string[];
  execute?: Tool<InferSchema<Schema>>['execute'];
}
/** Define a named tool's input once; its name comes from the tools object key. */
export declare function tool<const S extends JsonSchema | StandardJsonSchema>(options: ToolOptions<S>): Tool<InferSchema<S>>;
export type ToolCall<Tools extends ToolCollection = ToolCollection> = Tools extends ToolSet ? { [Name in keyof Tools & string]: {
  toolName: Name;
  input: Tools[Name] extends Tool<infer Input> ? Input : unknown;
}; }[keyof Tools & string] : {
  toolName: string;
  input: Record<string, JsonValue>;
};
//#endregion
//# sourceMappingURL=tools.d.ts.map