import express, { Request, Response } from "express";
import { body } from "express-validator";
import * as _ from "lodash";
import { validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";
import { BadRequestError } from "../../errors";

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
      address: toUpper(address),
      // @ts-ignore
      amenities: toUpper(amenities),
      // @ts-ignore
      facility: toUpper(facility),
      name: name.trim().toUpperCase(),
      // @ts-ignore
      rooms: toUpper(rooms),
      // @ts-ignore
      services: toUpper(services),
    });
    await hotel.save();

    res.status(201).send(hotel);
  }
);

const toUpper = (obj: Object) => {
  for (let i in obj) {
    // @ts-ignore
    obj[i] = obj[i].trim().toUpperCase();
  }
  return obj;
};
export { router as createHotelRouter };
