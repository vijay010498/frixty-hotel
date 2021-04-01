import { Request, Response, NextFunction } from "express";
import { NotAuthorizedError } from "../../not-authorized-error";
import { Admin } from "../../../models/Admin";
import jwt from "jsonwebtoken";
import { BadRequestError } from "../../bad-request-error";
const keys = require("../../../config/keys");

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session?.JWT) {
    throw new NotAuthorizedError();
  } else {
    let email, userId;
    try {
      const payload = await jwt.verify(req.session.JWT, keys.jwtAdminKey);
      // @ts-ignore
      email = payload.email.toString();
      // @ts-ignore
      userId = payload.userId.toString();
    } catch (e) {
      console.error(e);
      req.session = null;
      throw new NotAuthorizedError();
    }
    //check if existing admin
    const existingAdmin = await Admin.findById(userId);
    if (!existingAdmin) {
      req.session = null;
      throw new BadRequestError("Super Admin Does Not Exists");
    }
    next();
  }
};
