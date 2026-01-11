import express from "express"
import cors from "cors"
import routes from "./routes/index"
import { errorHandler } from "./middleware/errorHandler"
import { requestLogger } from "./middleware/requestLogger"
import bodyParser from "body-parser"
import { stripeWebhookHandler } from "./webhook/stripeWebhook"
import { validateEnv } from "./config/env"

// Validate environment variables at startup
validateEnv()

const app = express()

app.set("etag", false)
app.set("trust proxy", 1)

// Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://chat.selfrevolutions.com",
  "https://www.chat.selfrevolutions.com",
]

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl) only in development
    if (!origin) {
      const isDev = process.env.ENVIRONMENT === "development" || process.env.NODE_ENV === "development"
      if (isDev) {
        return callback(null, true)
      }
      // In production, reject requests without origin for API endpoints
      // (webhooks are handled separately before CORS middleware)
      return callback(null, false)
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(null, false)
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
}

app.use(cors(corsOptions))

// Stripe webhook must be before JSON body parser (needs raw body)
app.post(
  "/api/webhooks/stripe",
  bodyParser.raw({ type: "application/json" }),
  stripeWebhookHandler
)

app.use(express.json({ limit: "1mb" }))

app.use(requestLogger)

app.use("/api", routes)

// Health check endpoint (no auth required)
app.get("/api/health", async (_req, res) => {
  const hasSupabaseEnv =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

  let dbStatus: "ok" | "error" | "missing" | "unknown" =
    hasSupabaseEnv ? "unknown" : "missing"

  if (hasSupabaseEnv) {
    try {
      const { getSupabaseAdmin } = await import("./lib/supabase")
      const supabaseAdmin = getSupabaseAdmin()
      const { error } = await supabaseAdmin.from("conversations").select("id").limit(1)
      dbStatus = error ? "error" : "ok"
    } catch {
      dbStatus = "error"
    }
  }

  res.status(200).json({
    status: "ok",
    environment: process.env.ENVIRONMENT || "unknown",
    timestamp: new Date().toISOString(),
    services: {
      api: "ok",
      database: dbStatus,
      openai: process.env.OPENAI_API_KEY ? "configured" : "missing",
      stripe: process.env.STRIPE_SECRET_KEY ? "configured" : "missing",
    },
  })
})

app.use(errorHandler)

export default app
