import { Request, Response, NextFunction } from "express";
import { Admin } from "../../../models/Admin";
import jwt from "jsonwebtoken";
import { BadRequestError } from "../../bad-request-error";
import { NotAuthorizedError } from "../../not-authorized-error";
import { AdminSubscription } from "../../../models/AdminSubscriptions";
import mongoose from "mongoose";
import { Hotel } from "../../../models/Hotel";
const keys = require("../../../config/keys");
export const requireAdminSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const payload = jwt.verify(req.session!.JWT, keys.jwtAdminKey);
  // @ts-ignore
  const adminId = payload.userId;
  // @ts-ignore
  const hotelId = payload.hotelId;
  const subscriptionsThisAdmin = await AdminSubscription.aggregate([
    {
      $match: {
        $and: [
          {
            adminId: mongoose.Types.ObjectId(adminId),
          },
          {
            "paymentDetails.status": { $eq: "succeeded" },
          },
          {
            expiry: { $gt: new Date() },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "subscriptionId",
        foreignField: "_id",
        as: "subscriptionDetails",
      },
    },
    {
      $lookup: {
        from: "admins",
        localField: "adminId",
        foreignField: "_id",
        as: "adminDetails",
      },
    },
  ]);
  if (subscriptionsThisAdmin.length === 0) {
    //update hotel not visible
    //first check if hotel present -
    const hotel = await Hotel.findById(hotelId);
    if (hotel) {
      await Hotel.findOneAndUpdate(
        {
          _id: mongoose.Types.ObjectId(hotel.id),
        },
        {
          $set: {
            adminSubscribed: false,
          },
        }
      );
    }
    throw new BadRequestError("Not Subscribed To Any Subscriptions");
  }
  next();
};
