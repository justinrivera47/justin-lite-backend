import { AppError } from "./AppError"

export class ValidationError extends AppError {
  details?: unknown

  constructor(message = "Validation failed", details?: unknown) {
    super(message, 422, "VALIDATION_ERROR")
    this.details = details
  }
}
