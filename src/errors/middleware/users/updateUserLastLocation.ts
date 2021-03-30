import { Request, Response, NextFunction } from "express";
import { NotAuthorizedError } from "../../not-authorized-error";
import { User } from "../../../models/User";
import jwt from "jsonwebtoken";
const keys = require("../../../config/keys");
export const updateUserLastLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await next();
  if (req.query.isGeoQuery === "true") {
    if (req.query.jwtAuthToken) {
      try {
        //first decode jwt and get user id
        // @ts-ignore
        const payload = await jwt.verify(req.query.jwtAuthToken, keys.jwtKey);
        // @ts-ignore
        const userId = payload.userId;
        // @ts-ignore
        const email = payload.email;
        // @ts-ignore
        const userLat = parseFloat(req.query.latitude);
        // @ts-ignore
        const userLag = parseFloat(req.query.longitude);
        await User.findByIdAndUpdate(userId, {
          $set: {
            lastLocation: {
              type: "Point",
              coordinates: [userLag, userLat],
            },
          },
        });
      } catch (err) {
        console.log(err);
        return;
      }
    }
  }
};
