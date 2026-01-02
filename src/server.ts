import "dotenv/config"
import { createServer } from "http"
import app from "./app"

const PORT = process.env.PORT || 3000

const server = createServer(app)

server.listen(PORT, () => {
  console.log(
    `[Justin Lite] Server running on port ${PORT} | ENV=${process.env.ENVIRONMENT}`
  )
})
