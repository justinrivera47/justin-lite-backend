import express from "express"
import cors from "cors"
import routes from "./routes/index"
import { errorHandler } from "./middleware/errorHandler"
import { requestLogger } from "./middleware/requestLogger"
import bodyParser from "body-parser"
import { stripeWebhookHandler } from "./webhook/stripeWebhook"

const app = express()

app.set("etag", false)
app.set("trust proxy", 1)

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://chat.selfrevolutions.com",
      "https://www.chat.selfrevolutions.com",
    ]
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 204,
}

app.use(cors(corsOptions))

app.options(/.*/, cors(corsOptions))

app.post(
  "/api/webhooks/stripe",
  bodyParser.raw({ type: "application/json" }),
  stripeWebhookHandler
)

app.use(express.json({ limit: "1mb" }))

app.use(requestLogger)

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*")
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    return res.sendStatus(204)
  }
  next()
})


app.use("/api", routes)

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
    },
  })
})


app.use(errorHandler)

export default app
