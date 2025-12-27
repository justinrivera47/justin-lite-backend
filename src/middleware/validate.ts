import type { Request, Response, NextFunction } from "express"
import type { ZodTypeAny, ZodIssue } from "zod"
import { ValidationError } from "../errors/ValidationError"

function formatZodIssues(issues: readonly ZodIssue[]) {
  const fieldErrors: Record<string, string[]> = {}
  const formErrors: string[] = []

  for (const issue of issues) {
    // Zod path is PropertyKey[] (string | number | symbol)
    const key = issue.path.length ? issue.path.map(String).join(".") : ""

    if (!key) {
      formErrors.push(issue.message)
      continue
    }

    fieldErrors[key] ??= []
    fieldErrors[key].push(issue.message)
  }

  return { formErrors, fieldErrors }
}

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const details = formatZodIssues(result.error.issues)
      return next(new ValidationError("Validation failed", details))
    }

    req.body = result.data
    return next()
  }
}
