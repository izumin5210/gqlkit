/**
 * Input for creating a message that can target either a user or a group.
 * This tests basic inline `@oneOf` input object generation.
 */
export type CreateMessageInput = {
  content: string;
  /**
   * The target recipient - either a user ID or a group ID
   */
  recipient: { userId: string } | { groupId: string };
};

export type Message = {
  id: string;
  content: string;
};
