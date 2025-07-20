import express from "express";
import dotenv from "dotenv";

const envFile = process.env.ENVIRONMENT === "production" ? ".env.production" : ".env";
dotenv.config({ path: envFile });

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.get("/api/ping", (_, res) => {
  res.json({ message: `pong from ${process.env.ENVIRONMENT}` });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Justin Lite backend running in ${process.env.ENVIRONMENT} mode on port ${PORT}`);
});
