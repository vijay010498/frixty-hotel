import express, { Request, Response } from "express";
import { body } from "express-validator";
import { GatewayCharge } from "../../../models/GatewayCharges";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
import { validateRequest } from "../../../errors";

const router = express.Router({
  caseSensitive: true,
});

router.patch(
  "/api/v1/sAdmin/updateGatewayCharge",
  requireSuperAdmin,
  [body("percentage").isNumeric().withMessage("Percentage Must be number")],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { percentage } = req.body;
      const existingGatewayCharge = await GatewayCharge.find({})
        .sort({ _id: -1 })
        .limit(1);

      if (existingGatewayCharge.length === 0) {
        // No Percentage create new one
        const gatewayCharge = await GatewayCharge.build({
          percentage,
        });
        await gatewayCharge.save();
        res.status(201).send(gatewayCharge);
        return;
      } else {
        //update existing charge
        const existingGatewayCharge = await GatewayCharge.find({}).limit(1);
        await GatewayCharge.findOneAndUpdate(
          {
            _id: existingGatewayCharge[0]._id,
          },
          {
            $set: {
              percentage,
            },
          }
        );
        res.status(201).send({ message: "Percentage Updated" });
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(403).send(err);
      return;
    }
  }
);

export { router as superAdminConfigRouter };
