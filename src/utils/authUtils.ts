import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(email: string): string {
  const secret = process.env.JWT_SECRET || 'secret';
  return jwt.sign({ email }, secret, { expiresIn: '1h' });
}

export function verifyToken(token: string): jwt.JwtPayload {
  const secret = process.env.JWT_SECRET || 'secret';
  return jwt.verify(token, secret) as jwt.JwtPayload;
}
