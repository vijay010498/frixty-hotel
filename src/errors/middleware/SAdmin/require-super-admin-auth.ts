import { Request, Response, NextFunction, raw } from "express";
import { NotAuthorizedError } from "../../not-authorized-error";
import { SuperAdmin } from "../../../models/SuperAdmin";
import jwt from "jsonwebtoken";
import { BadRequestError } from "../../bad-request-error";
const keys = require("../../../config/keys");

export const requireSuperAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session?.JWT) {
    throw new NotAuthorizedError();
  } else {
    let email, userId;
    try {
      const payload = await jwt.verify(req.session.JWT, keys.jwtSuperAdminKey);
      // @ts-ignore
      email = payload.email.toString();
      // @ts-ignore
      userId = payload.userId.toString();
    } catch (err) {
      console.error(err);
      req.session = null;
      throw new NotAuthorizedError();
    }
    //first check is existing Super Admin
    const existingSuperAdmin = await SuperAdmin.findById(userId);
    if (!existingSuperAdmin) {
      req.session = null;
      throw new BadRequestError("Super Admin Does Not Exists");
    }
    next();
  }
};
