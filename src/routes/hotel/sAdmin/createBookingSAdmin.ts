import express, { Request, Response } from "express";
import { Booking } from "../../../models/Booking";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
import { BadRequestError, validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";

const router = express.Router({
  caseSensitive: true,
});

router.post(
  "/api/secure/sAdmin/createBooking",
  requireSuperAdmin,
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

export { router as superAdminCreateBookingRouter };
