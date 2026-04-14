const encoder = new TextEncoder();

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | {
      [key: string]: JsonLike | undefined;
    };

function sortValue(value: unknown): JsonLike {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, JsonLike>>((accumulator, key) => {
        const nextValue = record[key];
        if (typeof nextValue !== "undefined") {
          accumulator[key] = sortValue(nextValue);
        }
        return accumulator;
      }, {});
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  return JSON.stringify(value);
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function canonicalizeBytes(value: unknown): Uint8Array {
  return encoder.encode(canonicalizeJson(value));
}
