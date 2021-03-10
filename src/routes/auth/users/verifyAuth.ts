import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../../errors";

import jwt from "jsonwebtoken";
const keys = require("../../../config/keys");

const router = express.Router();

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

export { router as verifyAuthRouter };
