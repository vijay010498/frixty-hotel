import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Password } from "../../../services/auth/password";

import jwt from "jsonwebtoken";
import {
  BadRequestError,
  NotAuthorizedError,
  validateRequest,
} from "../../../errors";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
import { SuperAdmin } from "../../../models/SuperAdmin";
const keys = require("../../../config/keys");

const router = express.Router({
  caseSensitive: true,
});

router.patch(
  "/api/secure/sAdmin/changePassword",
  requireSuperAdmin,
  [
    body("oldPassword")
      .trim()
      .notEmpty()
      .withMessage("You Must Supply the old Password"),
    body("newPassword")
      .trim()
      .notEmpty()
      .withMessage("You must supply the new password"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    const payload = await jwt.verify(req.session!.JWT, keys.jwtSuperAdminKey);
    // @ts-ignore
    const email = payload.email.toString();
    // @ts-ignore
    const userId = payload.userId.toString();
    const existingSuperAdmin = await SuperAdmin.findById(userId);
    const passwordMatches = await Password.compare(
      existingSuperAdmin!.password,
      oldPassword
    );
    if (!passwordMatches) {
      throw new BadRequestError("old Password Does Not Match");
    }

    //old password matches patch new password and update session
    try {
      await SuperAdmin.findOneAndUpdate(
        {
          _id: userId,
        },
        {
          $set: {
            password: newPassword,
          },
        }
      );
      //generate session and store
      try {
        const JWT = await jwt.sign(
          {
            userId: existingSuperAdmin!.id,
            email: existingSuperAdmin!.email,
          },
          keys.jwtSuperAdminKey,
          {
            expiresIn: keys.JWTEXPIRETIMESUPERADMIN,
            algorithm: "HS512",
          }
        );

        req.session = {
          JWT,
        };
        res.status(201).send(existingSuperAdmin);
        return;
      } catch (err) {
        console.error(err);
        res.status(401).send(err);
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(401).send(err);
      return;
    }
  }
);

export { router as superAdminChangePasswordRouter };
