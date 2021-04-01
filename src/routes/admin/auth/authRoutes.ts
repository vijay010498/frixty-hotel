import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Password } from "../../../services/auth/password";
import { Admin } from "../../../models/Admin";
import { OTP } from "../../../models/OTP";
import { requireAdmin } from "../../../errors/middleware/admin/require-admin";
import { BadRequestError, validateRequest } from "../../../errors";
import jwt from "jsonwebtoken";
import MailService from "@sendgrid/mail";
import { OTPService } from "../../../services/auth/OTPService";
const keys = require("../../../config/keys");
const router = express.Router({
  caseSensitive: true,
});

router.post(
  "/api/secure/v1/admin/signIn",
  [
    body("email").isEmail().withMessage("Email must be valid"),
    body("password")
      .trim()
      .notEmpty()
      .withMessage("You Must supply a password"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const existingAdmin = await Admin.findOne({ email: email });
    if (!existingAdmin) {
      throw new BadRequestError("Invalid Credentials");
    }

    const passwordMatches = await Password.compare(
      existingAdmin.password,
      password
    );
    if (!passwordMatches) {
      throw new BadRequestError("Invalid Password");
    }

    try {
      const JWT = await jwt.sign(
        {
          userId: existingAdmin.id,
          email: existingAdmin.email,
          hotelId: existingAdmin.hotelId,
        },
        keys.jwtAdminKey,
        {
          expiresIn: keys.jwtAdminExpireTime,
          algorithm: "HS512",
        }
      );
      req.session = {
        JWT,
      };
      res.status(201).send(existingAdmin);
      return;
    } catch (e) {
      console.error(e);
      res.status(401).send(e);
      return;
    }
  }
);
router.post("/api/secure/v1/admin/signOut", (req: Request, res: Response) => {
  req.session = null;
  const cookies = req.cookies;
  for (let key in cookies) {
    if (cookies.hasOwnProperty(key)) {
      res.clearCookie(key);
    }
  }
  res.status(200).send({
    message: "Successfully Signed Out",
  });
});

router.get(
  "/api/secure/v1/admin/verifyAuth",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    if (!req.session || !req.session.JWT) {
      res.status(401).send({ message: "Not Authorised" });
      return;
    } //verify is jwt is valid
    try {
      await jwt.verify(req.session.JWT, keys.jwtAdminKey);
      res.status(202).send({
        message: "Admin Verified",
      });
      return;
    } catch (err) {
      res.status(401).send({
        message: "Not Authorised",
      });
      return;
    }
  }
);
router.patch(
  "/api/secure/v1/admin/changePassword",
  requireAdmin,
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
    const payload = await jwt.verify(req.session!.JWT, keys.jwtAdminKey);
    // @ts-ignore
    const email = payload.email.toString();
    // @ts-ignore
    const userId = payload.userId.toString();
    const existingAdmin = await Admin.findById(userId);
    const passwordMatches = await Password.compare(
      existingAdmin!.password,
      oldPassword
    );
    if (!passwordMatches) {
      throw new BadRequestError("old Password Does Not Match");
    }
    //old password matches patch new password and update session
    try {
      await Admin.findOneAndUpdate(
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
            userId: existingAdmin!.id,
            email: existingAdmin!.email,
            hotelId: existingAdmin!.hotelId,
          },
          keys.jwtAdminKey,
          {
            expiresIn: keys.jwtAdminExpireTime,
            algorithm: "HS512",
          }
        );
        req.session = {
          JWT,
        };
        res.status(201).send(existingAdmin);
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
router.post(
  "/api/secure/v1/admin/requestOTP",
  [body("email").isEmail().withMessage("Email Must Be Valid")],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email } = req.body;
    //first check if admin exists to prevent flooding attacks
    const doesAdminExists = await Admin.findOne({ email: email });
    if (!doesAdminExists) {
      throw new BadRequestError("Admin Does Not Exists");
    }
    //check if already requested for OTP in last 5 minutes
    const alreadyRequested = await OTP.findOne({ email: email });
    if (alreadyRequested) {
      const { createdAt } = alreadyRequested;
      const lastOTPSentTimeStamp = createdAt.getTime();
      throw new BadRequestError(
        `OTP Sent Already, Please wait 5 minutes from last sent OTP request \n last Sent : ${lastOTPSentTimeStamp}`
      );
    }
    const sixDigitOTP = Math.floor(100000 + Math.random() * 900000);
    //send Mail First
    const OTPEmail = {
      to: {
        email: email,
        name: doesAdminExists.companyName,
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
        name: doesAdminExists.companyName,
        OTP: sixDigitOTP,
      },
    };
    try {
      // @ts-ignore
      await MailService.send(OTPEmail);

      //IF OTP send successfully in EMAIL
      const userOTP = await OTP.build({
        OTP: sixDigitOTP,
        email: doesAdminExists.email,
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
router.patch(
  "/api/secure/v1/admin/verifyOTPAndChangePassword",
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
    //first check if admin exists to prevent flooding attacks
    const doesAdminExists = await Admin.findOne({ email: email });
    if (!doesAdminExists) {
      throw new BadRequestError("Admin Does Not Exists");
    }
    //check if OTP is requested
    const doesOTPRequested = await OTP.findOne({ email: email });
    if (!doesOTPRequested) {
      //OPT NOT Requested of expired
      throw new BadRequestError(
        "OPT Not Requested or Expired, Please Request For OTP Again"
      );
    } //Now Check if entered OTP is correct
    // @ts-ignore
    const OTPMatch = await OTPService.compare(doesOTPRequested.OTP, userOTP);
    if (!OTPMatch) {
      throw new BadRequestError("Invalid OTP");
    }
    //OTP Verified
    try {
      await OTP.deleteOne({ email: email });

      //change password
      await Admin.findOneAndUpdate(
        {
          email: email,
        },
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
            userId: doesAdminExists.id,
            email: doesAdminExists.email,
            hotelId: doesAdminExists.hotelId,
          },
          keys.jwtAdminKey,
          {
            expiresIn: keys.jwtAdminExpireTime,
            algorithm: "HS512",
          }
        );
        req.session = {
          JWT,
        };
        res.status(201).send(doesAdminExists);
        return;
      } catch (e) {
        console.error(e);
        res.status(400).send(e);
        return;
      }
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
      return;
    }
  }
);

export { router as adminAuthRouter };
