import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Hotel } from "../../models/Hotel";
import { BadRequestError } from "../../errors";

const router = express.Router();

const perPage = 10;

router.get("/api/v1/hotels", async (req: Request, res: Response) => {
  const totalHotels = await Hotel.find().countDocuments();
  // @ts-ignore
  let page = parseInt(req.query.page);

  if (!page) {
    page = 0;
  }
  if (page >= Math.ceil(totalHotels / perPage)) {
    page = 0;
  }

  const hotels = await Hotel.find()
    // @ts-ignore
    .skip(perPage * page)
    .limit(perPage);
  if (hotels.length === 0) {
    throw new BadRequestError("No Hotels Found");
  }
  res.status(200).send({
    hotels: hotels,
    totalHotels,
    page: page,
    pages: Math.ceil(totalHotels / perPage),
  });
  return;
});

export { router as getAllHotelsRouter };
