import express, { Request, Response } from "express";
import { body } from "express-validator";
import * as _ from "lodash";
import { validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";
import { BadRequestError } from "../../../errors";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";

const router = express.Router({
  caseSensitive: true,
});

router.post(
  "/api/secure/sAdmin/createHotel",
  requireSuperAdmin,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const {
      name,
      address,
      rooms,
      location,
      languagesSpoken,
      description,
      amenities,
      images,
      homeCurrency,
    } = req.body;

    const existingHotel = await Hotel.findOne({ name: name.toUpperCase() });

    if (existingHotel) {
      throw new BadRequestError("Hotel Name Already exists");
    }
    try {
      const hotel = Hotel.build({
        address,
        name,
        rooms,
        location,
        languagesSpoken,
        description,
        amenities,
        images,
        homeCurrency,
      });
      await hotel.save();

      res.status(201).send(hotel);
      return;
    } catch (err) {
      console.error(err);
      res.status(401).send(err);
      return;
    }
  }
);

export { router as superAdminCreateHotelRouter };
