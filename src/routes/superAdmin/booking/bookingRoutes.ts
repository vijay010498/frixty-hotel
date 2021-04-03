import express, { Request, Response } from "express";
import { Booking } from "../../../models/Booking";
import { requireSuperAdminAuth } from "../../../errors/middleware/SAdmin/require-super-admin-auth";
import { BadRequestError, validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";

const router = express.Router({
  caseSensitive: true,
});

router.post(
  "/api/secure/sAdmin/createBooking",
  requireSuperAdminAuth,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const { userId, hotelId, roomId, bookingDetails } = req.body;

    //check is hotel and user Id Exists
    const doesHotelExists = await Hotel.findById(hotelId);
    if (!doesHotelExists) {
      throw new BadRequestError("Hotel Does Not Exists");
    }
    //check if room exists in that hotel
    const doesRoomExists = await Hotel.findOne({
      _id: hotelId,
      "rooms._id": roomId,
    });
    if (!doesRoomExists) {
      throw new BadRequestError("No Room Exists With the Given ID");
    }

    try {
      const booking = Booking.build({
        userId,
        hotelId,
        roomId,
        bookingDetails,
      });

      await booking.save();
      res.status(201).send(booking);
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
      return;
    }
  }
);

router.get(
  "/api/secure/sAdmin/Bookings",
  requireSuperAdminAuth,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const bookings = await Booking.aggregate([
      {
        $lookup: {
          from: "hotels",
          localField: "hotelId",
          foreignField: "_id",
          as: "hotel",
        },
      },
    ]);
    if (bookings.length === 0) {
      throw new BadRequestError("No Bookings Found");
    }
    await transformObject(bookings);
    res.status(200).send({
      bookings,
    });
    return;
  }
);

const transformObject = async (bookings: Array<any>) => {
  for (let i = 0; i < bookings.length; i++) {
    bookings[i].id = bookings[i]._id;
    delete bookings[i]._id;
    delete bookings[i].__v;
    if (bookings[i].hotel) {
      for (let j = 0; j < bookings[i].hotel.length; j++) {
        bookings[i].hotel[j].id = bookings[i].hotel[j]._id;
        delete bookings[i].hotel[j]._id;
        delete bookings[i].hotel[j].__v;
        if (bookings[i].hotel[j].rooms) {
          for (let k = 0; k < bookings[i].hotel[j].rooms.length; k++) {
            bookings[i].hotel[j].rooms[k].id =
              bookings[i].hotel[j].rooms[k]._id;
            delete bookings[i].hotel[j].rooms[k]._id;
            delete bookings[i].hotel[j].rooms[k].__v;
          }
        }
      }
    }
  }
};

export { router as superAdminBookingRouter };
