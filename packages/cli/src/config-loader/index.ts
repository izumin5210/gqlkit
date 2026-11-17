export {
  type ResolveFederationConfigParams,
  type ResolveFederationConfigResult,
  resolveFederationConfig,
} from "./federation-validator.js";
export {
  type LoadConfigOptions,
  type LoadConfigResult,
  loadConfig,
} from "./loader.js";

export type {
  ResolvedConfig,
  ResolvedApolloFederationConfig,
  ResolvedComposeDirectiveLink,
  ResolvedDiscriminatorFieldsMap,
  ResolvedFederationConfig,
  ResolvedHooksConfig,
  ResolvedOutputConfig,
  ResolvedScalarMapping,
} from "./types.js";

export type {
  ValidateConfigOptions,
  ValidateConfigResult,
} from "./validator.js";
