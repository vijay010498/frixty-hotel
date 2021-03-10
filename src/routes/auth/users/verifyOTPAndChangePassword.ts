import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../../errors";
import { OTP } from "../../../models/OTP";
import { User } from "../../../models/User";
import { BadRequestError } from "../../../errors";
import { OTPService } from "../../../services/auth/OTPService";

import jwt from "jsonwebtoken";
const keys = require("../../../config/keys");
const router = express.Router();
router.patch(
  "/api/v1/users/verifyOTPAndChangePassword",
  [
    body("email").isEmail().withMessage("Email Must be Valid"),
    body("userOTP")
      .isNumeric({
        no_symbols: true,
      })
      .isLength({
        min: 6,
        max: 6,
      })
      .withMessage("OTP Must Be Valid"),
    body("password").isString().withMessage("Please Provide The New Password"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, userOTP, password } = req.body;
    //First check if user exists
    const doesUserExists = await User.findOne({ email: email });
    if (!doesUserExists) {
      throw new BadRequestError("No User Exists");
    }

    //Check if OTP is requested
    const doesOTPRequested = await OTP.findOne({ email: email });
    if (!doesOTPRequested) {
      //OPT NOT Requested of expired
      throw new BadRequestError(
        "OPT Not Requested or Expired, Please Request For OTP Again"
      );
    }

    //All Ok NoW Check if the Entered OTP is Correct

    // @ts-ignore
    const OTPMatch = await OTPService.compare(doesOTPRequested.OTP, userOTP);
    if (!OTPMatch) {
      throw new BadRequestError("Invalid OTP");
    }

    //OTP Verified
    //first make the verified OTP expired
    try {
      await OTP.deleteOne({ email: email });
      //change Password
      await User.findOneAndUpdate(
        { email: email },
        {
          $set: {
            password: password,
          },
        }
      );
      try {
        //generate new JWT Token and send with the response
        const jwtAuthToken = await jwt.sign(
          {
            userId: doesUserExists.id,
            email: doesUserExists.email,
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

export { router as verifyOTPRouter };
