import express, { Request, Response } from "express";

import { validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";
import { BadRequestError } from "../../../errors";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";

const router = express.Router({
  caseSensitive: true,
});
router.get(
  "/api/secure/sAdmin/hotels",
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const hotels = await Hotel.find();
    if (hotels.length === 0) {
      throw new BadRequestError("No Hotels Found");
    }
    res.status(200).send({
      hotels: hotels,
    });
    return;
  }
);
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
        isBlockedByAdmin: false,
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

export { router as superAdminHotelRouter };
