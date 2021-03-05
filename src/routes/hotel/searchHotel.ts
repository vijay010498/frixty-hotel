import express, { Request, Response } from "express";
import { param, query } from "express-validator";
import { NotFoundError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";

const router = express.Router();

router.get(
  "/api/v1/hotels/search",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const city = req.query.city;
    const state = req.query.state;

    if (city !== undefined && state !== undefined) {
      const hotels = await Hotel.find({
        "address.city": city.toString().toUpperCase(),
        "address.state": state.toString().toUpperCase(),
      });
      if (!hotels) {
        throw new NotFoundError();
      }
      res.send(hotels).status(200);
    } else if (city !== undefined) {
      const hotels = await Hotel.find({
        "address.city": city.toString().toUpperCase(),
      });
      if (!hotels) {
        throw new NotFoundError();
      }
      res.send(hotels).status(200);
    } else if (state !== undefined) {
      const hotels = await Hotel.find({
        "address.state": state.toString().toUpperCase(),
      });
      if (!hotels) {
        throw new NotFoundError();
      }
      res.send(hotels).status(200);
    }
  }
);

export { router as searchHotelByStateRouter };
