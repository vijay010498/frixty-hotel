import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../../errors";
import { OTP } from "../../../models/OTP";
import { User } from "../../../models/User";
import { BadRequestError } from "../../../errors";
import { OTPService } from "../../../services/auth/OTPService";

const router = express.Router();
router.put(
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
      res.status(200).send("Password Updated Successfully");
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
    }
  }
);

export { router as verifyOTPRouter };
