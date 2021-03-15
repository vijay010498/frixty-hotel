import express, { Request, Response } from "express";
import { body } from "express-validator";
import { OTP } from "../../../models/OTP";
import { SuperAdmin } from "../../../models/SuperAdmin";
import { OTPService } from "../../../services/auth/OTPService";
const keys = require("../../../config/keys");
import jwt from "jsonwebtoken";
import { BadRequestError, validateRequest } from "../../../errors";
const router = express.Router({
  caseSensitive: true,
});

router.patch(
  "/api/secure/sAdmin/verifyOTPAndChangePassword",
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
    body("password")
      .trim()
      .notEmpty()
      .withMessage("Please Provide The New Password"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, userOTP, password } = req.body;

    //first check is super admin exists to prevent flooding attacks
    const doesSuperAdminExists = await SuperAdmin.findOne({ email: email });
    if (!doesSuperAdminExists) {
      throw new BadRequestError("Super Admin Does Not Exist");
    }

    //check if OTP is requested
    const doesOTPRequested = await OTP.findOne({ email: email });
    if (!doesOTPRequested) {
      //OPT NOT Requested of expired
      throw new BadRequestError(
        "OPT Not Requested or Expired, Please Request For OTP Again"
      );
    }

    //Now Check if entered OTP is correct
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
      await SuperAdmin.findOneAndUpdate(
        { email: email },
        {
          $set: {
            password: password,
          },
        }
      );

      //generate session and store
      try {
        const JWT = await jwt.sign(
          {
            userId: doesSuperAdminExists.id,
            email: doesSuperAdminExists.email,
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
        res.status(201).send(doesSuperAdminExists);
        return;
      } catch (err) {
        console.error(err);
        res.status(400).send(err);
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
      return;
    }
  }
);

export { router as superAdminVerifyOTPAndChangePasswordRouter };
