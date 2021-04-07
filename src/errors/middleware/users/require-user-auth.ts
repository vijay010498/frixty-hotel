import { Request, Response, NextFunction } from "express";
import { NotAuthorizedError } from "../../not-authorized-error";
import { User } from "../../../models/User";
import jwt from "jsonwebtoken";
import { BadRequestError } from "../../bad-request-error";
const keys = require("../../../config/keys");

export const requireUserAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.jwtAuthToken) {
    throw new NotAuthorizedError();
  } else {
    let email, userId;
    try {
      // @ts-ignore
      const payload = await jwt.verify(req.body.jwtAuthToken, keys.jwtKey);
      // @ts-ignore
      userId = payload.userId;
      // @ts-ignore
      email = payload.email;
    } catch (e) {
      console.error(e);
      throw new NotAuthorizedError();
    }
    //check existing user
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      throw new NotAuthorizedError();
    }
    next();
  }
};
