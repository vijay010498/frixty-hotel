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
    const {
      name,
      address,
      rooms,
      location,
      outdoors,
      pets,
      general,
      activities,
      frontDeskServices,
      foodAndDrink,
      entertainmentAndFamilyServices,
      cleaningServices,
      businessFacilities,
      safetyAndSecurity,
      spa,
      internet,
      parking,
      outdoorSwimmingPool,
      languagesSpoken,
      description,
      images,
    } = req.body;

    const existingHotel = await Hotel.findOne({ name: name.toUpperCase() });

    if (existingHotel) {
      throw new BadRequestError("Hotel Name Already exists");
    }
    try {
      const hotel = Hotel.build({
        address: address,
        name: name,
        rooms: rooms,
        location: location,
        outdoors: outdoors,
        activities: activities,
        businessFacilities: businessFacilities,
        cleaningServices: cleaningServices,
        entertainmentAndFamilyServices: entertainmentAndFamilyServices,
        foodAndDrink: foodAndDrink,
        frontDeskServices: frontDeskServices,
        general: general,
        internet: internet,
        languagesSpoken: languagesSpoken,
        outdoorSwimmingPool: outdoorSwimmingPool,
        parking: parking,
        pets: pets,
        safetyAndSecurity: safetyAndSecurity,
        spa: spa,
        description,
        images,
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

export { router as createHotelRouter };
