import { Request, Response } from 'express';
import { supabaseAdmin } from '../utils/utils/supabaseClient';

export async function signup(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  const { data, error } = await supabaseAdmin.auth.signUp({
    email,
    password,
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  return res.status(200).json({ message: 'Signup successful', data });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ message: error.message });
  }

  return res.status(200).json({ message: 'Login successful', token: data.session?.access_token });
}

export async function logout(req: Request, res: Response) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token required' });
  }

  const { error } = await supabaseAdmin.auth.signOut();

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  return res.status(200).json({ message: 'Logout successful' });
}
