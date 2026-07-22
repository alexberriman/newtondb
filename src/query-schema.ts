import type { JsonObject } from "./json.js";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const descriptor of Object.values(
      Object.getOwnPropertyDescriptors(value),
    )) {
      if ("value" in descriptor) deepFreeze(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

export const queryGrammarVersion = 1 as const;

/** JSON Schema 2020-12 contract for the serializable query grammar. */
export const queryJsonSchema = deepFreeze({
  $defs: {
    boolean: {
      oneOf: [
        {
          additionalProperties: false,
          properties: {
            conditions: {
              items: { $ref: "#/$defs/where" },
              minItems: 1,
              type: "array",
            },
            op: { enum: ["and", "or"] },
          },
          required: ["op", "conditions"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            condition: { $ref: "#/$defs/where" },
            op: { const: "not" },
          },
          required: ["op", "condition"],
          type: "object",
        },
      ],
    },
    comparison: {
      oneOf: [
        {
          additionalProperties: false,
          properties: {
            op: { enum: ["contains", "eq", "gt", "gte", "lt", "lte", "ne"] },
            path: { $ref: "#/$defs/path" },
            value: { $ref: "#/$defs/primitive" },
          },
          required: ["op", "path", "value"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            op: { enum: ["endsWith", "startsWith"] },
            path: { $ref: "#/$defs/path" },
            value: { type: "string" },
          },
          required: ["op", "path", "value"],
          type: "object",
        },
        {
          additionalProperties: false,
          properties: {
            op: { const: "in" },
            path: { $ref: "#/$defs/path" },
            value: {
              items: { $ref: "#/$defs/primitive" },
              maxItems: 10000,
              type: "array",
            },
          },
          required: ["op", "path", "value"],
          type: "object",
        },
      ],
    },
    path: {
      prefixItems: [{ type: "string" }],
      items: { anyOf: [{ type: "string" }, { minimum: 0, type: "integer" }] },
      maxItems: 32,
      minItems: 1,
      type: "array",
    },
    primitive: {
      anyOf: [
        { type: "boolean" },
        { type: "null" },
        { type: "number" },
        { type: "string" },
      ],
    },
    where: {
      oneOf: [{ $ref: "#/$defs/boolean" }, { $ref: "#/$defs/comparison" }],
    },
  },
  $id: "https://newtondb.dev/schema/query.json",
  $ref: "#/$defs/where",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "NewtonDB serializable query",
} as const satisfies JsonObject);
