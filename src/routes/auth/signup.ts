import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../errors";
import { User } from "../../models/User";
import { BadRequestError } from "../../errors";

const router = express.Router();

router.post(
  "/api/v1/users/signup",
  [body("email").isEmail().withMessage("Email must be valid")],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password, fullName, passportNumber, phoneNumber } = req.body;

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      throw new BadRequestError("Email Already in use");
    }
    const user = User.build({
      email: email,
      password: password,
      fullName: fullName,
      passportNumber: passportNumber,
      phoneNumber: phoneNumber,
    });
    await user.save();

    res.status(201).send(user);
  }
);

export { router as signupRouter };
