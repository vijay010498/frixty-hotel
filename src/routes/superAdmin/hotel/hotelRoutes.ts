import express, { Request, Response } from "express";

import { validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";
import { BadRequestError } from "../../../errors";
import { requireSuperAdminAuth } from "../../../errors/middleware/SAdmin/require-super-admin-auth";

const router = express.Router({
  caseSensitive: true,
});
router.get(
  "/api/secure/sAdmin/hotels",
  requireSuperAdminAuth,
  async (req: Request, res: Response) => {
    const hotels = await Hotel.aggregate([
      {
        $lookup: {
          from: "bookings",
          localField: "_id",
          foreignField: "hotelId",
          as: "bookings",
        },
      },
    ]);
    if (hotels.length === 0) {
      throw new BadRequestError("No Hotels Found");
    }
    await transFormObject(hotels);
    res.status(200).send({
      hotels: hotels,
    });
    return;
  }
);
router.post(
  "/api/secure/sAdmin/createHotel",
  requireSuperAdminAuth,
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
      propertyType,
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
        propertyType,
        isBlockedByAdmin: false,
        adminSubscribed: false,
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

const transFormObject = async (hotels: Array<any>) => {
  for (let i = 0; i < hotels.length; i++) {
    hotels[i].id = hotels[i]._id;
    delete hotels[i]._id;
    delete hotels[i].__v;
    if (hotels[i].rooms) {
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        hotels[i].rooms[j].id = hotels[i].rooms[j]._id;
        delete hotels[i].rooms[j]._id;
        delete hotels[i].rooms[j].__v;
      }
    }
    if (hotels[i].bookings) {
      for (let j = 0; j < hotels[i].bookings.length; j++) {
        hotels[i].bookings[j].id = hotels[i].bookings[j]._id;
        delete hotels[i].bookings[j]._id;
        delete hotels[i].bookings[j].__v;
      }
    }
  }
};

export { router as superAdminHotelRouter };
