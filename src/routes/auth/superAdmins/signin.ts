import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Password } from "../../../services/auth/password";
import { SuperAdmin } from "../../../models/SuperAdmin";

import jwt from "jsonwebtoken";
import { BadRequestError, validateRequest } from "../../../errors";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
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

export { router as superAdminSignInRouter };
