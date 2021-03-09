import express, { Request, Response } from "express";
import { param, query } from "express-validator";
import { BadRequestError, NotFoundError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";

const router = express.Router();

const perPage = 10; //
router.get(
  "/api/v1/hotels/search",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const city = req.query.city;
    const state = req.query.state;
    // @ts-ignore
    let page = parseInt(req.query.page);

    if (!page) page = 0;

    //Search by both city and state
    if (city !== undefined && state !== undefined) {
      const totalHotels = await Hotel.find({
        "address.city": city.toString().toUpperCase(),
        "address.state": state.toString().toUpperCase(),
      }).countDocuments();

      if (page >= Math.ceil(totalHotels / perPage)) {
        page = 0;
      }
      const hotels = await Hotel.find({
        "address.city": city.toString().toUpperCase(),
        "address.state": state.toString().toUpperCase(),
      })
        .skip(perPage * page)
        .limit(perPage);
      if (hotels.length === 0) {
        throw new BadRequestError("No Hotels Found");
      }
      res
        .send({
          hotels: hotels,
          page: page,
          pages: Math.ceil(totalHotels / perPage),
        })
        .status(200);
    }
    //Search by only city
    else if (city !== undefined) {
      const totalHotels = await Hotel.find({
        "address.city": city.toString().toUpperCase(),
      }).countDocuments();
      if (page >= Math.ceil(totalHotels / perPage)) {
        page = 0;
      }
      const hotels = await Hotel.find({
        "address.city": city.toString().toUpperCase(),
      })
        .skip(perPage * page)
        .limit(perPage);
      if (hotels.length === 0) {
        throw new BadRequestError("No Hotels Found");
      }
      res
        .send({
          hotels: hotels,
          page: page,
          pages: Math.ceil(totalHotels / perPage),
        })
        .status(200);
    }
    //search by only state
    else if (state !== undefined) {
      const totalHotels = await Hotel.find({
        "address.state": state.toString().toUpperCase(),
      }).countDocuments();
      if (page >= Math.ceil(totalHotels / perPage)) {
        page = 0;
      }
      const hotels = await Hotel.find({
        "address.state": state.toString().toUpperCase(),
      })
        .skip(perPage * page)
        .limit(perPage);
      if (hotels.length === 0) {
        throw new BadRequestError("No Hotels Found");
      }
      res
        .send({
          hotels: hotels,
          page: page,
          pages: Math.ceil(totalHotels / perPage),
        })
        .status(200);
    }
  }
);

export { router as searchHotelByStateRouter };
