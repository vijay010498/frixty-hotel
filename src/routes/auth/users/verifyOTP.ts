import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../../errors";
import { OTP } from "../../../models/OTP";
import { User } from "../../../models/User";
import { BadRequestError } from "../../../errors";
import { OTPService } from "../../../services/auth/OTPService";

const router = express.Router();
router.post(
  "/api/v1/users/verifyOTP",
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
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, userOTP } = req.body;
    //First check if user exists
    const doesUserExists = await User.findOne({ email: email });
    if (!doesUserExists) {
      throw new BadRequestError("No User Exists");
    }

    //Check if OTP is requested
    const doesOTPRequested = await OTP.findOne({ email: email });
    if (!doesOTPRequested) {
      //OPT NOT Requested of expired
      res
        .send({
          errors: [
            {
              message:
                "OPT Not Requested or Expired, Please Request For OTP Again",
            },
          ],
        })
        .status(400);
      return;
    }

    //All Ok NoW Check if the Entered OTP is Correct

    // @ts-ignore
    const OTPMatch = await OTPService.compare(doesOTPRequested.OTP, userOTP);
    if (!OTPMatch) {
      throw new BadRequestError("Invalid OTP");
    }

    //OTP Verified
    //first make the verified OTP expired
    await OTP.deleteOne({ email: email });
    res.status(200).send("OTP Verified Successfully");
  }
);

export { router as verifyOTPRouter };
