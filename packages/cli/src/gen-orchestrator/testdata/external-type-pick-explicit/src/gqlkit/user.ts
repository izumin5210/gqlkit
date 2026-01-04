interface ExternalUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  _count: number;
}

export type User = Pick<ExternalUser, "id" | "name" | "email">;
