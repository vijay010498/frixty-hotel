import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Password } from "../../../services/auth/password";
import { User } from "../../../models/User";
import { validateRequest } from "../../../errors";
import { BadRequestError } from "../../../errors";

import jwt from "jsonwebtoken";
const keys = require("../../../config/keys");

const router = express.Router();

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

export { router as signInRouter };
