import express, { Request, Response } from "express"
import cors from "cors"
import routes from "./routes"
import { errorHandler } from "./middleware/errorHandler"
import { supabaseAdmin } from "./lib/supabase"
import { requestLogger } from "./middleware/requestLogger"

const app = express()

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://selfrevolutions.com",
        "https://www.selfrevolutions.com",
      ]

      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error("CORS not allowed"))
    },
    credentials: true,
  })
)

app.use(express.json({ limit: "1mb" }))

app.use(requestLogger)

app.use("/api", routes)

app.get("/health", async (_req: Request, res: Response) => {
  let dbStatus = "unknown"

  try {
    const { error } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .limit(1)

    dbStatus = error ? "error" : "ok"
  } catch {
    dbStatus = "error"
  }

  res.status(200).json({
    status: "ok",
    environment: process.env.ENVIRONMENT || "unknown",
    timestamp: new Date().toISOString(),
    services: {
      api: "ok",
      database: dbStatus,
      openai: process.env.OPENAI_API_KEY ? "configured" : "missing",
    },
  })
})

app.use(errorHandler)

export default app
