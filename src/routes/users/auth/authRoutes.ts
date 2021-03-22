import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../../errors";
import { User } from "../../../models/User";
import { BadRequestError } from "../../../errors";
import jwt from "jsonwebtoken";
import { Password } from "../../../services/auth/password";
import { OTP } from "../../../models/OTP";
import MailService from "@sendgrid/mail";
import { OTPService } from "../../../services/auth/OTPService";
const keys = require("../../../config/keys");
const router = express.Router();

MailService.setApiKey(keys.sendgridAPI);

router.post(
  "/api/v1/users/signup",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password, fullName, passportNumber, phoneNumber } = req.body;

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      throw new BadRequestError("Email Already in use");
    }
    try {
      const user = User.build({
        email: email,
        password: password,
        fullName: fullName,
        passportNumber: passportNumber,
        phoneNumber: phoneNumber,
      });
      await user.save();

      //generate JWTToken and send with the user response
      const jwtAuthToken = await jwt.sign(
        {
          userId: user.id,
          email: user.email,
        },
        keys.jwtSuperAdminKey,
        {
          expiresIn: keys.JWTEXPIRETIMESUPERADMIN,
          algorithm: "HS512",
        }
      );
      console.log(jwtAuthToken);
      res.status(201).send({
        user,
        auth: {
          jwtAuthToken,
        },
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
  "/api/v1/users/signin",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email: email });
    if (!existingUser) {
      throw new BadRequestError("Invalid Credentials");
    }
    const passwordsMatch = await Password.compare(
      existingUser.password,
      password
    );

    if (!passwordsMatch) {
      throw new BadRequestError("Invalid Credentials");
    }
    try {
      //generate JWTToken and send with the user response
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
        user: existingUser,
        auth: {
          jwtAuthToken,
        },
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
  "/api/v1/users/verifyAuthToken",
  [body("jwtAuthToken").isString().withMessage("JWT Auth Token Must be Given")],
  validateRequest,
  async (req: Request, res: Response) => {
    const { jwtAuthToken } = req.body;

    //verify jwt token
    try {
      await jwt.verify(jwtAuthToken, keys.jwtKey);
      res.status(202).send({
        message: "Given Auth Token is Valid And Verified",
      });
      return;
    } catch (err) {
      res.status(401).send(err);
      return;
    }
  }
);
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

export { router as userAuthRouter };
