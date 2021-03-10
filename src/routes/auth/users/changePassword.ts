import express, { Request, Response } from "express";
import { body } from "express-validator";
import { NotAuthorizedError, validateRequest } from "../../../errors";
import { Password } from "../../../services/auth/password";
import { User } from "../../../models/User";
import { BadRequestError } from "../../../errors";

import jwt from "jsonwebtoken";
const keys = require("../../../config/keys");

const router = express.Router();

router.patch(
  "/api/v1/users/changePassword",
  [
    body("newPassword").isString().withMessage("New Password Must Be Given"),
    body("oldPassword").isString().withMessage("Old Password Must Be Given"),
    body("jwtAuthToken").isString().withMessage("JWT Auth Token Must be Given"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { jwtAuthToken, oldPassword, newPassword } = req.body;
    let email, userId;
    //First verify jwtAuthToken to get email and userID
    try {
      const payload = await jwt.verify(jwtAuthToken, keys.jwtKey);
      // @ts-ignore
      email = payload.email.toString();
      // @ts-ignore
      userId = payload.userId.toString();
    } catch (err) {
      console.error(err);
      res.status(401).send(err);
      return;
    }

    //first check is existing user
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      throw new BadRequestError("User Not Exists");
    }
    //check if old password matches
    const passwordMatch = await Password.compare(
      existingUser.password,
      oldPassword
    );
    if (!passwordMatch) {
      throw new BadRequestError("Old Password Not Matched");
    }

    //Old Password Matched all check done now change password
    try {
      await User.findOneAndUpdate(
        {
          _id: userId,
        },
        {
          $set: {
            password: newPassword,
          },
        }
      );
      try {
        //Generate new JWT and send with the response
        const jwtAuthToken = await jwt.sign(
          {
            userId: existingUser.id,
            email: existingUser.email,
          },
          keys.jwtKey,
          {
            expiresIn: keys.JWTEXPIRETIME,
            algorithm: "HS512",
          }
        );
        res.status(200).send({
          message: "Password Updated Successfully",
          auth: {
            jwtAuthToken,
          },
        });
        return;
      } catch (err) {
        console.error(err);
        res.send(err).status(401);
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
      return;
    }
  }
);

export { router as changePasswordRouter };
