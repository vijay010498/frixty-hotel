import express, { Request, Response } from "express";

import { validateRequest } from "../../../errors";

import { BadRequestError } from "../../../errors";

import { requireSuperAdminAuth } from "../../../errors/middleware/SAdmin/require-super-admin-auth";
import { Subscription } from "../../../models/Subscription";

const router = express.Router({
  caseSensitive: true,
});

router.get(
  "/api/secure/sAdmin/subscriptions",
  requireSuperAdminAuth,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const subscriptions = await Subscription.find();
      res.status(200).send(subscriptions);
      return;
    } catch (err) {
      console.error(err);
      res.status(401).send(err);
      return;
    }
  }
);

router.post(
  "/api/secure/sAdmin/subscriptions",
  requireSuperAdminAuth,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const {
      name,
      image,
      description,
      currency,
      amount,
      validityInDays,
      totalRoomsPermitted,
      totalHotelImagesPermitted,
      totalRoomImagesPermitted,
    } = req.body;
    try {
      const subscription = Subscription.build({
        amount,
        currency,
        description,
        image: image ? image : "",
        name,
        totalHotelImagesPermitted,
        totalRoomImagesPermitted,
        totalRoomsPermitted,
        validityInDays,
      });
      await subscription.save();
      res.status(201).send(subscription);
      return;
    } catch (err) {
      console.error(err);
      res.status(401).send(err);
      return;
    }
  }
);

export { router as superAdminSubscriptionRouter };
