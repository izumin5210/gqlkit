/**
 * User type
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Container with invalid inline union containing primitive type.
 * GraphQL unions cannot contain primitives.
 */
export type Container = {
  id: string;
  /**
   * Invalid union with string primitive - should error
   */
  data: User | string;
};

/**
 * Another invalid case with number primitive.
 */
export type NumberContainer = {
  id: string;
  /**
   * Invalid union with number primitive - should error
   */
  value: User | number;
};
