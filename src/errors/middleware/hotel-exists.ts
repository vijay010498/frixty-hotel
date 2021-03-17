import { Request, Response, NextFunction } from "express";
import { Hotel } from "../../models/Hotel";
import { BadRequestError } from "../bad-request-error";

export const checkHotelExists = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  //check if hotel exists
  let hotel;
  try {
    hotel = await Hotel.findById(req.params.hotelId);
  } catch (err) {
    console.log(err);
    res.status(403).send(err);
  }

  if (!hotel) {
    throw new BadRequestError("Hotel Not Found");
  }
  next();
};
