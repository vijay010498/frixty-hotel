import express, { Request, Response } from "express";
import { body } from "express-validator";
import * as _ from "lodash";
import { validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";
import { BadRequestError } from "../../../errors";

const router = express.Router();

router.post(
  "/api/v1/sadmin/createhotel",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const { name, address, facility, amenities, rooms, services } = req.body;

    const existingHotel = await Hotel.findOne({ name: name.toUpperCase() });

    if (existingHotel) {
      throw new BadRequestError("Hotel Name Already exists");
    }

    const hotel = Hotel.build({
      address: address,
      amenities: amenities,
      facility: facility,
      name: name,
      rooms: rooms,
      services: services,
    });
    await hotel.save();

    res.status(201).send(hotel);
  }
);

export { router as createHotelRouter };
