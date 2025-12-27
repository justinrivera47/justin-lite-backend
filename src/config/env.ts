// src/config/env.ts
export function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export const FRONTEND_URL = requireEnv("FRONTEND_URL")

if (!FRONTEND_URL.startsWith("http")) {
  throw new Error("FRONTEND_URL must include http:// or https://")
}
