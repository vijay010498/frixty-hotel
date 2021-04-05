import express, { Request, Response } from "express";
import { Booking } from "../../../models/Booking";
import { requireAdminAuth } from "../../../errors/middleware/admin/require-admin-auth";
import { requireAdminSubscription } from "../../../errors/middleware/admin/require-admin-subscription";
import jwt from "jsonwebtoken";
import { BadRequestError } from "../../../errors";
import mongoose from "mongoose";
const keys = require("../../../config/keys");
const router = express.Router({
  caseSensitive: true,
});
router.get(
  "/api/secure/v1/admin/myBookingsConfirmed",
  requireAdminAuth,
  requireAdminSubscription,
  async (req: Request, res: Response) => {
    const payload = jwt.verify(req.session?.JWT, keys.jwtAdminKey);
    // @ts-ignore
    const hotelId = payload.hotelId;
    const bookingsCheckIn = await Booking.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          "bookingDetails.bookingStatus": { $eq: "confirmed" },
        },
      },
      {
        $project: {
          "bookingDetails.checkOutDateTime": 0,
        },
      },
    ]);
    const bookingsCheckOut = await Booking.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          "bookingDetails.bookingStatus": { $eq: "confirmed" },
        },
      },
      {
        $project: {
          "bookingDetails.checkInDateTime": 0,
        },
      },
    ]);
    const bookings = [...bookingsCheckIn, ...bookingsCheckOut];
    if (bookings.length === 0) {
      throw new BadRequestError("no Bookings Found");
    }
    await transformMyBookingsConfirmed(bookings);
    res.send({
      bookings: bookings,
    });
    return;
  }
);

async function transformMyBookingsConfirmed(bookings: Array<any>) {
  for (let i = 0; i < bookings.length; i++) {
    bookings[i].id = bookings[i]._id;
    delete bookings[i]._id;
    delete bookings[i].__id;
  }
}

export { router as adminBookingsRouter };
