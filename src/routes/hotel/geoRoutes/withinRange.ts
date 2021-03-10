import express, { Request, Response } from "express";
import { body } from "express-validator";
import { BadRequestError, validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";

const defaultMeterRange = 5 * 1000; //default nearBy distance is 5KM or 5000 meter
const perPage = 10;
const router = express.Router();

router.get(
  "/api/v1/hotels/geo/near-me",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    // @ts-ignore
    const latitude = parseFloat(req.query.latitude);
    // @ts-ignore
    const longitude = parseFloat(req.query.longitude);
    // @ts-ignore
    let page = parseInt(req.query.page) || 0;

    // @ts-ignore
    let rangeKM = req.query.range;
    let rangeInMeter = 0;

    if (rangeKM !== undefined) {
      // @ts-ignore
      rangeKM = parseFloat(req.query.range);
      //convert km to meter
      // @ts-ignore
      rangeInMeter = rangeKM * 1000;
    }

    //No Within Range
    if (rangeKM === undefined) {
      const totalHotels = await Hotel.find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: defaultMeterRange,
          },
        },
      }).count();

      /*const totalHotels1 = await Hotel.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            distanceField: "distance",
          },
        },
      ]);
      // @ts-ignore
      console.log(totalHotels1.length);
      console.log(totalHotels1);*/

      if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
        page = 0;
      }

      const hotels = await Hotel.find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: defaultMeterRange,
          },
        },
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
      return;
    }
    //within certain range in KM
    else if (rangeKM !== undefined) {
      const totalHotels = await Hotel.find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: rangeInMeter,
          },
        },
      }).count();
      if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
        page = 0;
      }
      const hotels = await Hotel.find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: rangeInMeter,
          },
        },
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

export { router as hotelsWithinRangeRouter };
