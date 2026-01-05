// src/routes/account.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { updateProfileSchema } from "../validation/accountSchemas";
import { updateUserProfile } from "../services/accountService";
import { deleteAccount, getProfile } from "../controllers/accountController";

const router = Router();

router.patch(
  "/profile",
  requireAuth,
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { first_name, last_name } = req.body;
      const updated = await updateUserProfile(userId, first_name, last_name);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

router.get("/profile", requireAuth, getProfile)

router.delete("/", requireAuth, deleteAccount);

export default router;
