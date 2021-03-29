import express, { Request, Response } from "express";
import { BadRequestError, validateRequest } from "../../../errors";
import { Charges } from "../../../models/Charges";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";

const router = express.Router({
  caseSensitive: true,
});
router.post(
  "/api/secure/sAdmin/charges",
  requireSuperAdmin,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const { name, isApplicable, percentage } = req.body;
    const existingCharges = await Charges.findOne({ name: name.toUpperCase() });
    if (existingCharges) {
      throw new BadRequestError("Charges Name Already Exists");
    }
    try {
      const charges = Charges.build({
        isApplicable,
        name,
        percentage,
      });
      await charges.save();
      res.status(201).send(charges);
    } catch (err) {
      console.error(err);
      res.status(401).send(err);
      return;
    }
  }
);

export { router as superAdminChargesRouter };
