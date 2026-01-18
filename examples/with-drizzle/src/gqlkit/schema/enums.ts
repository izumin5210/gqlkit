import type { postStatusEnum, userStatusEnum } from "../../db/schema.js";

/**
 * User account status
 */
export type UserStatus = (typeof userStatusEnum.enumValues)[number];

/**
 * Post publication status
 */
export type PostStatus = (typeof postStatusEnum.enumValues)[number];
