import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Hotel } from "../../../models/Hotel";
import { BadRequestError } from "../../../errors";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";

const router = express.Router({
  caseSensitive: true,
});

router.get(
  "/api/secure/sAdmin/hotels",
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const hotels = await Hotel.find();
    if (hotels.length === 0) {
      throw new BadRequestError("No Hotels Found");
    }
    res.status(200).send({
      hotels: hotels,
    });
    return;
  }
);

export { router as getAllHotelsRouter };
