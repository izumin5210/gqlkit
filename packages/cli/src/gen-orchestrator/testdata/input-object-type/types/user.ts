export interface User {
  id: string;
  name: string;
  email: string | null;
}

export interface CreateUserInput {
  name: string;
  email?: string;
}
