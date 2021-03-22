import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Password } from "../../../services/auth/password";
import { SuperAdmin } from "../../../models/SuperAdmin";
import { OTP } from "../../../models/OTP";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
import jwt from "jsonwebtoken";
import { BadRequestError, validateRequest } from "../../../errors";
import MailService from "@sendgrid/mail";
import { OTPService } from "../../../services/auth/OTPService";
const keys = require("../../../config/keys");

const router = express.Router({
  caseSensitive: true,
});

router.post(
  "/api/secure/sAdmin/signIn",
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

    const existingSuperAdmin = await SuperAdmin.findOne({ email: email });
    if (!existingSuperAdmin) {
      throw new BadRequestError("Invalid Credentials");
    }

    const passwordMatches = await Password.compare(
      existingSuperAdmin.password,
      password
    );
    if (!passwordMatches) {
      throw new BadRequestError("Invalid Password");
    }
    try {
      //Generate jwt and store in session
      const JWT = await jwt.sign(
        {
          userId: existingSuperAdmin.id,
          email: existingSuperAdmin.email,
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
  }
);

router.post("/api/secure/sAdmin/signOut", (req, res) => {
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
  "/api/secure/sAdmin/verifyAuth",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    if (!req.session || !req.session.JWT) {
      res.status(401).send({});
      return;
    }
    //verify is jwt is valid
    try {
      await jwt.verify(req.session.JWT, keys.jwtSuperAdminKey);
      res.status(202).send({});
      return;
    } catch (err) {
      res.status(401).send({});
      return;
    }
  }
);

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
router.post(
  "/api/secure/sAdmin/signup",
  requireSuperAdmin,
  [
    body("email").isEmail().withMessage("Email Must Be Valid"),
    body("password")
      .trim()
      .isLength({
        min: 6,
        max: 20,
      })
      .withMessage("Password Must be between 6 and 20"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password, fullName, phoneNumber } = req.body;
    const existingSuperAdmin = await SuperAdmin.findOne({ email: email });
    if (existingSuperAdmin) {
      throw new BadRequestError(
        "Super Admin Already Exists. Please Contact The Database Administrator"
      );
    }

    try {
      const superAdmin = SuperAdmin.build({
        email: email,
        fullName: fullName,
        password: password,
        phoneNumber: phoneNumber,
      });
      await superAdmin.save();

      //Generate jwt and store in session
      const JWT = await jwt.sign(
        {
          userId: superAdmin.id,
          email: superAdmin.email,
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

      res.status(201).send(superAdmin);
      return;
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
      return;
    }
  }
);
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

export { router as superAdminAuthRoutes };
