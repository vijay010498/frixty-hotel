import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../../errors";
import { User } from "../../../models/User";
import { OTP } from "../../../models/OTP";
import { BadRequestError } from "../../../errors";
import MailService from "@sendgrid/mail";
const keys = require("../../../config/keys");
const router = express.Router();
MailService.setApiKey(keys.sendgridAPI);

router.post(
  "/api/v1/users/requestotp",
  [body("email").isEmail().withMessage("Email Must Be Valid")],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email } = req.body;

    //first check if user presents fo prevent attacks
    const doesUserExists = await User.findOne({ email: email });
    if (!doesUserExists) {
      throw new BadRequestError("No User Exists");
    }

    //First check if already requested for OTP in last 5 minutes
    const alreadyRequested = await OTP.findOne({ email: email });
    if (alreadyRequested) {
      const { createdAt } = alreadyRequested;
      const lastSentTimeStamp = createdAt.getTime();
      throw new BadRequestError(
        "OTP Sent Already, Please wait 5 minutes from last sent OTP request"
      );
    }

    const sixDigitOTP = Math.floor(100000 + Math.random() * 900000);

    //send Mail first
    const OTPEmail = {
      to: {
        email: email,
        name: doesUserExists.fullName,
      },
      from: {
        email: "frixty-security@mails.oncampus.in",
        name: "Frixty Password Reset OTP",
      },
      reply_to: {
        email: "frixty-security@mails.oncampus.in",
        name: "Frixty",
      },
      click_tracking: {
        enable: true,
        enable_text: true,
      },
      open_tracking: {
        enable: true,
      },
      template_id: keys.forgotPasswordOTPTemplate,
      dynamic_template_data: {
        name: doesUserExists.fullName,
        OTP: sixDigitOTP,
      },
    };

    try {
      // @ts-ignore
      await MailService.send(OTPEmail);

      //IF OTP SENT Successfully in EMAIL
      const userOTP = await OTP.build({
        OTP: sixDigitOTP,
        email: email,
      });
      await userOTP.save();
      res
        .status(201)
        .send("OTP Sent Successfully To Mail. Otp Will Expire in 5 Minutes");
    } catch (err) {
      console.error(err);
      res.send(err).status(401);
    }
  }
);

export { router as requestOTPRouter };
