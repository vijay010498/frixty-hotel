import express, { Request, Response } from "express";
import { BadRequestError, validateRequest } from "../../../errors";
import { Charges } from "../../../models/Charges";
import { requireSuperAdminAuth } from "../../../errors/middleware/SAdmin/require-super-admin-auth";

const router = express.Router({
  caseSensitive: true,
});
router.post(
  "/api/secure/sAdmin/charges",
  requireSuperAdminAuth,
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

router.get(
  "/api/secure/sAdmin/charges",
  requireSuperAdminAuth,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const charges = await Charges.find();
    if (charges.length === 0) {
      throw new BadRequestError("No Charges Found");
    }
    res.status(200).send({
      charges,
    });
    return;
  }
);

router.delete(
  "/api/secure/sAdmin/charges",
  requireSuperAdminAuth,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    await Charges.findByIdAndDelete(req.query.chargeId);
    res.status(200).send();
    return;
  }
);

export { router as superAdminChargesRouter };
