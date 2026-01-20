// src/routes/index.ts
import { Router } from "express";
import billingRoutes from "./billing";
import conversationRoutes from "./conversations";
import accountRoutes from "./account";
import signupRoutes from "./signup";

const router = Router();

router.use("/billing", billingRoutes);
router.use("/conversations", conversationRoutes);
router.use("/account", accountRoutes);
router.use("/signup", signupRoutes);

export default router;
