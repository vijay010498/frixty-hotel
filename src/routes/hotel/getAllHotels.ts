import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Hotel } from "../../models/Hotel";

const router = express.Router();

router.get("/api/v1/hotels", async (req: Request, res: Response) => {
  const hotels = await Hotel.find({});

  res.send(hotels).status(200);
});

export { router as getAllHotelsRouter };
