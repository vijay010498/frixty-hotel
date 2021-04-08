import { Request, Response, NextFunction } from "express";
import { Booking } from "../../../models/Booking";
import { BadRequestError } from "../../bad-request-error";

export const requireBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { bookingId } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new BadRequestError("No Booking Found");
  }
  next();
};
