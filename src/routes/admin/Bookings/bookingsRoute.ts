import express, { Request, Response } from "express";
import { Booking } from "../../../models/Booking";
import { requireAdminAuth } from "../../../errors/middleware/admin/require-admin-auth";
import { requireAdminSubscription } from "../../../errors/middleware/admin/require-admin-subscription";
import jwt from "jsonwebtoken";
import _ from "lodash";
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
    const bookings = await Booking.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          "bookingDetails.bookingStatus": { $eq: "confirmed" },
        },
      },
      {
        $lookup: {
          from: "hotels",
          localField: "hotelId",
          foreignField: "_id",
          as: "hotel",
        },
      },
    ]);
    /* const bookingsCheckIn = await Booking.aggregate([
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
      {
        $lookup: {
          from: "hotels",
          localField: "hotelId",
          foreignField: "_id",
          as: "hotel",
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
      {
        $lookup: {
          from: "hotels",
          localField: "hotelId",
          foreignField: "_id",
          as: "hotel",
        },
      },
    ]);
    const bookings = [...bookingsCheckIn, ...bookingsCheckOut];*/
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
    delete bookings[i].__v;
    /*  if (bookings[i].bookingDetails.checkInDateTime) {
      bookings[i].title = "Check In";
      bookings[i].color = "green";
      bookings[i].start = new Date(bookings[i].bookingDetails.checkInDateTime);
      bookings[i].end = new Date(bookings[i].bookingDetails.checkInDateTime);
    } else {
      bookings[i].title = "Check Out";
      bookings[i].color = "red";
      bookings[i].start = new Date(bookings[i].bookingDetails.checkOutDateTime);
      bookings[i].end = new Date(bookings[i].bookingDetails.checkOutDateTime);
    }*/
    for (let j = 0; j < bookings[i].hotel.length; j++) {
      bookings[i].hotel[j].id = bookings[i].hotel[j]._id;
      delete bookings[i].hotel[j]._id;
      delete bookings[i].hotel[j].__v;
      for (let k = 0; k < bookings[i].hotel[j].rooms.length; k++) {
        bookings[i].hotel[j].rooms[k].id = bookings[i].hotel[j].rooms[k]._id;
        delete bookings[i].hotel[j].rooms[k]._id;
        delete bookings[i].hotel[j].rooms[k].__v;
        if (
          bookings[i].hotel[j].rooms[k].id.toString() ===
          bookings[i].roomId.toString()
        ) {
          bookings[i].roomType = bookings[i].hotel[j].rooms[k].roomType;
          bookings[i].title = bookings[i].id.toString().slice(18, 24);
          const titleColors = ["orange", "green", "danger", "azure", "warning"];
          bookings[i].color = _.sample(titleColors);
          bookings[i].allDay = true;
          bookings[i].start = new Date(
            bookings[i].bookingDetails.checkInDateTime
          );
          bookings[i].end = new Date(
            bookings[i].bookingDetails.checkOutDateTime
          );
        }
      }
    }
  }
}

export { router as adminBookingsRouter };
