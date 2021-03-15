import express, { Request, Response } from "express";
import { body } from "express-validator";
import { SuperAdmin } from "../../../models/SuperAdmin";
import { OTP } from "../../../models/OTP";
import MailService from "@sendgrid/mail";
import { BadRequestError, validateRequest } from "../../../errors";
const keys = require("../../../config/keys");
const router = express.Router({
  caseSensitive: true,
});
router.post(
  "/api/secure/sAdmin/requestOTP",
  [body("email").isEmail().withMessage("Email Must Be Valid")],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email } = req.body;
    //first check is super admin exists to prevent flooding attacks
    const doesSuperAdminExists = await SuperAdmin.findOne({ email: email });
    if (!doesSuperAdminExists) {
      throw new BadRequestError("Super Admin Does Not Exist");
    }

    //check if already requested for OTP in last 5 minutes
    const alreadyRequested = await OTP.findOne({ email: email });
    if (alreadyRequested) {
      const { createdAt } = alreadyRequested;
      const lastOTPSentTimeStamp = createdAt.getTime();
      throw new BadRequestError(
        "OTP Sent Already, Please wait 5 minutes from last sent OTP request"
      );
    }
    const sixDigitOTP = Math.floor(100000 + Math.random() * 900000);

    //send Mail First
    const OTPEmail = {
      to: {
        email: email,
        name: doesSuperAdminExists.fullName,
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
        name: doesSuperAdminExists.fullName,
        OTP: sixDigitOTP,
      },
    };

    try {
      // @ts-ignore
      await MailService.send(OTPEmail);

      //IF OTP send successfully in EMAIL
      const userOTP = await OTP.build({
        OTP: sixDigitOTP,
        email: doesSuperAdminExists.email,
      });
      await userOTP.save();
      res.status(201).send({
        message: "OTP Sent Successfully To Mail. Otp Will Expire in 5 Minutes",
      });
      return;
    } catch (err) {
      console.error(err);
      res.status(401).send(err);
      return;
    }
  }
);

export { router as superAdminRequestOTPRouter };
