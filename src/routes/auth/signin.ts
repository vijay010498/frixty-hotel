import express, { Request, Response } from "express";
import { body } from "express-validator";

import { Password } from "../../services/auth/password";
import { User } from "../../models/User";
import { validateRequest } from "../../errors";
import { BadRequestError } from "../../errors";

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

    res.status(200).send(existingUser);
  }
);

export { router as signInRouter };
