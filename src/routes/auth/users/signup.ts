import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../../errors";
import { User } from "../../../models/User";
import { BadRequestError } from "../../../errors";
import jwt from "jsonwebtoken";
const keys = require("../../../config/keys");

const router = express.Router();

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

export { router as signupRouter };
