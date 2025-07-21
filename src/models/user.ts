export interface User {
  email: string;
  passwordHash: string;
}

const users: User[] = [];

export function createUser(email: string, passwordHash: string): void {
  users.push({ email, passwordHash });
}

export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}
