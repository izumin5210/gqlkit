export type JSONValue =
  | null
  | string
  | number
  | boolean
  | JSONObject
  | JSONValue[];

export type JSONObject = {
  [key: string]: JSONValue | undefined;
};

export type ProviderMetadata = Record<string, JSONObject>;
