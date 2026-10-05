import { faker } from "@faker-js/faker";

/**
 * Resolve Freeform Twig faker defaults (e.g. `{{ faker.firstName|raw }}`)
 * into real values with @faker-js/faker — mirrors Craft's PHP Faker usage.
 */
const FAKER_EXPR =
  /\{\{\s*faker\.([a-zA-Z_]\w*)\s*(?:\(([^)]*)\))?\s*(?:\|[^}]*)?\}\}/g;

function parseArgs(raw?: string): unknown[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw.split(",").map((part) => {
    const token = part.trim();
    if (token === "true") {
      return true;
    }
    if (token === "false") {
      return false;
    }
    if (/^-?\d+(\.\d+)?$/.test(token)) {
      return Number(token);
    }
    if (
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('"') && token.endsWith('"'))
    ) {
      return token.slice(1, -1);
    }
    return token;
  });
}

function callFaker(method: string, args: unknown[]): string {
  switch (method) {
    case "firstName":
      return faker.person.firstName();
    case "lastName":
      return faker.person.lastName();
    case "name":
      return faker.person.fullName();
    case "company":
      return faker.company.name();
    case "email":
      return faker.internet.email();
    case "phoneNumber":
      // Freeform phone validation expects ###-###-#### (no parentheses/extension).
      return faker.helpers.fromRegExp("[2-9][0-9]{2}-[0-9]{3}-[0-9]{4}");
    case "url":
      return faker.internet.url();
    case "sentence":
      return faker.lorem.sentence();
    case "sentences": {
      const count = typeof args[0] === "number" ? args[0] : 3;
      return faker.lorem.sentences(count);
    }
    case "text":
      return faker.lorem.paragraph();
    case "paragraph":
      return faker.lorem.paragraph();
    case "paragraphs": {
      // Keep demos readable — default to 2 short paragraphs (not Faker’s heavy 3).
      const count = typeof args[0] === "number" ? Math.max(1, args[0]) : 2;
      return faker.lorem.paragraphs(count, "\n\n");
    }
    case "word":
      return faker.lorem.word();
    case "words": {
      const count = typeof args[0] === "number" ? args[0] : 3;
      return faker.lorem.words(count);
    }
    case "streetAddress":
      return faker.location.streetAddress();
    case "city":
      return faker.location.city();
    case "postcode":
    case "postalCode":
      return faker.location.zipCode();
    case "boolean":
      return String(faker.datatype.boolean());
    case "uuid":
      return faker.string.uuid();
    default:
      return `{{ faker.${method} }}`;
  }
}

export function resolveFakerTwig(value: string): string {
  if (!value.includes("faker.")) {
    return value;
  }

  return value.replace(
    FAKER_EXPR,
    (match, method: string, argsRaw?: string) => {
      try {
        return callFaker(method, parseArgs(argsRaw));
      } catch {
        return match;
      }
    },
  );
}

type ManifestLike = {
  fields?: Record<string, { defaultValue?: unknown; [key: string]: unknown }>;
  [key: string]: unknown;
};

export function resolveManifestFakerDefaults<T extends ManifestLike>(
  manifest: T,
): T {
  if (!manifest.fields) {
    return manifest;
  }

  const fields: typeof manifest.fields = {};
  for (const [handle, field] of Object.entries(manifest.fields)) {
    if (typeof field.defaultValue === "string") {
      fields[handle] = {
        ...field,
        defaultValue: resolveFakerTwig(field.defaultValue),
      };
    } else {
      fields[handle] = field;
    }
  }

  return { ...manifest, fields };
}

function transformPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const body = payload as Record<string, unknown>;

  // REST: { success, data: FreeformManifest }
  if (
    body.data &&
    typeof body.data === "object" &&
    body.data !== null &&
    "fields" in body.data
  ) {
    return {
      ...body,
      data: resolveManifestFakerDefaults(
        body.data as ManifestLike,
      ),
    };
  }

  // GraphQL: { data: { freeformHeadlessManifest: {...} } }
  const gqlData = body.data as Record<string, unknown> | undefined;
  if (
    gqlData?.freeformHeadlessManifest &&
    typeof gqlData.freeformHeadlessManifest === "object"
  ) {
    return {
      ...body,
      data: {
        ...gqlData,
        freeformHeadlessManifest: resolveManifestFakerDefaults(
          gqlData.freeformHeadlessManifest as ManifestLike,
        ),
      },
    };
  }

  return payload;
}

/** Wrap fetch so Freeform manifests get faker Twig defaults resolved. */
export function withFakerResolvedFetch(
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      return response;
    }

    try {
      const payload = transformPayload(await response.clone().json());
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      return response;
    }
  };
}
