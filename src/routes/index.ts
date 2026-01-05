// src/routes/index.ts
import { Router } from "express";
import billingRoutes from "./billing";
import conversationRoutes from "./conversations";
import accountRoutes from "./account";

const router = Router();

router.use("/billing", billingRoutes);
router.use("/conversations", conversationRoutes);
router.use("/account", accountRoutes);

export default router;
