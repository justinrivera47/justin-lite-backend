import { Request, Response } from 'express';
import { hashPassword, comparePasswords, generateToken } from '../utils/authUtils';
import { createUser, findUserByEmail } from '../models/user';

export async function signup(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  const existing = findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ message: 'User already exists' });
  }
  const hashed = await hashPassword(password);
  createUser(email, hashed);
  res.json({ message: 'User created' });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const valid = await comparePasswords(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = generateToken(email);
  res.json({ token });
}

export async function logout(_req: Request, res: Response) {
  // Token invalidation would happen here in a real app
  res.json({ message: 'Logged out' });
}
