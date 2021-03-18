import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../../errors";
import jwt from "jsonwebtoken";
const keys = require("../../../config/keys");

const router = express.Router({
  caseSensitive: true,
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

export { router as superAdminVerifyAuth };
