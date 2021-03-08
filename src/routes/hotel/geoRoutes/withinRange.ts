import express, { Request, Response } from "express";
import { body } from "express-validator";
import { NotFoundError, validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";

const defaultMeterRange = 5 * 1000; //default nearBy distance is 5KM or 5000 meter

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
    let rangeKM = req.query.range;
    let rangeInMeter = 0;

    if (rangeKM !== undefined) {
      // @ts-ignore
      rangeKM = parseFloat(req.query.range);
      //convert km to meter
      // @ts-ignore
      rangeInMeter = rangeKM * 1000;
    }

    if (rangeKM === undefined) {
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
      });
      if (!hotels) {
        throw new NotFoundError();
      }
      res.send(hotels);
    } else if (rangeKM !== undefined) {
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
      });
      if (!hotels) {
        throw new NotFoundError();
      }
      res.send(hotels);
    }
  }
);

export { router as hotelsWithinRangeRouter };
