// src/validation/accountSchemas.ts
import { z } from "zod";

export const updateProfileSchema = z
  .object({
    first_name: z.string().trim().min(1).max(60).optional(),
    last_name: z.string().trim().min(1).max(60).optional(),
  })
  .refine((v) => v.first_name || v.last_name, {
    message: "Nothing to update",
  });
