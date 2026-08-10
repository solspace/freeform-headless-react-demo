/** Craft GraphQL client for Freeform headless adapters. */

const graphqlPath =
  import.meta.env.VITE_GRAPHQL_PATH?.trim() || "/actions/graphql/api";
const graphqlToken = import.meta.env.VITE_GRAPHQL_TOKEN?.trim() || "";

export type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function craftGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (graphqlToken) {
    headers.Authorization = `Bearer ${graphqlToken}`;
  }

  const response = await fetch(graphqlPath, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as GraphqlResponse<T>;

  if (!response.ok) {
    throw new Error(
      payload.errors?.[0]?.message ??
        `GraphQL HTTP ${response.status}: ${response.statusText}`,
    );
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("GraphQL response missing data.");
  }

  return payload.data;
}

export const HEADLESS_MANIFEST_QUERY = `
  query FreeformHeadlessManifest($handle: String!) {
    freeformHeadlessManifest(handle: $handle)
  }
`;

export const HEADLESS_SUBMIT_MUTATION = `
  mutation FreeformHeadlessSubmit(
    $handle: String!
    $intent: String
    $values: FreeformJson
    $meta: FreeformJson
    $context: FreeformJson
  ) {
    freeformHeadlessSubmit(
      handle: $handle
      intent: $intent
      values: $values
      meta: $meta
      context: $context
    )
  }
`;
