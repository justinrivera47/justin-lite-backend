import { Request, Response } from 'express';

export function chat(_req: Request, res: Response) {
  res.json({ message: 'This will call OpenAI API later' });
}
