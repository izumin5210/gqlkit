export type Post = {
  id: string;
  title: string;
  /** Post status with prefix matching field context */
  status:
    | "POST_STATUS_DRAFT"
    | "POST_STATUS_PUBLISHED"
    | "POST_STATUS_ARCHIVED";
  /** Array of tags with prefix */
  tags: ("POST_TAGS_TECH" | "POST_TAGS_LIFESTYLE" | "POST_TAGS_NEWS")[];
};

export type User = {
  id: string;
  name: string;
  /** User role with prefix matching field context */
  role: "USER_ROLE_ADMIN" | "USER_ROLE_MEMBER" | "USER_ROLE_GUEST";
};
