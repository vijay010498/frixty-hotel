import express, { Request, Response } from "express";
import { body } from "express-validator";
import { SuperAdmin } from "../../../models/SuperAdmin";
import jwt from "jsonwebtoken";
import { BadRequestError, validateRequest } from "../../../errors";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
const keys = require("../../../config/keys");
const router = express.Router({
  caseSensitive: true,
});

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

export { router as superAdminSignupRouter };
