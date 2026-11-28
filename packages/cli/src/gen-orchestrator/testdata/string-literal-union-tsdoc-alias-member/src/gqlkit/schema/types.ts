type BaseStatus =
  | /** Active status */ "ACTIVE"
  | /** Inactive status */ "INACTIVE";

/**
 * Members that come from another alias have no type node in this union,
 * so only the member written here has a description.
 */
export type ExtendedStatus = BaseStatus | /** Archived status */ "ARCHIVED";

export type User = {
  id: string;
  status: ExtendedStatus;
};
