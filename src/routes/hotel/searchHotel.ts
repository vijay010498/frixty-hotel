import express, { Request, Response } from "express";
import { body, param, query } from "express-validator";
import { BadRequestError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";

const router = express.Router();
const defaultMeterRange = 5 * 1000; //default nearBy distance is 5KM or 5000 meter
const perPage = 10; //
router.get(
  "/api/v1/hotels/search",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    // @ts-ignore
    let page = parseInt(req.query.page) || 0;

    let isFilterBy = false;
    let isGeoQuery = false;
    const isFilter_ByString = req.query.isFilterBy || "false ";
    const isGeoQueryString = req.query.isGeoQuery || "false";
    if (isFilter_ByString === "true") isFilterBy = true;
    if (isGeoQueryString === "true") isGeoQuery = true;

    //Filter By Is Enabled
    if (isFilterBy) {
      const city = req.query.city;
      const state = req.query.state;
      if (city === undefined && state === undefined) {
        throw new BadRequestError(
          "City or State Must Be Given If filter is enabled. Otherwise set is_Filter_By = 'false'"
        );
      }

      //filter with geoQuery
      if (isGeoQuery) {
        // @ts-ignore
        const latitude = parseFloat(req.query.latitude);
        // @ts-ignore
        const longitude = parseFloat(req.query.longitude);
        // @ts-ignore
        let rangeKM = req.query.range;
        let rangeInMeter = 0;
        if (!latitude || !longitude) {
          throw new BadRequestError("Latitude and Longitude must be given");
        }

        if (rangeKM !== undefined) {
          // @ts-ignore
          rangeKM = parseFloat(req.query.range);
          //convert km to meter
          // @ts-ignore
          rangeInMeter = rangeKM * 1000;
        }

        if (rangeKM === undefined) {
          //No Within Range

          //city and state
          if (city !== undefined && state !== undefined) {
            const totalHotelsDB = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  $maxDistance: defaultMeterRange,
                },
              },
              {
                $match: {
                  "address.city": city.toString().toUpperCase(),
                  "address.state": state.toString().toUpperCase(),
                },
              },
            ]).count("totalHotels");
            let totalHotels = 0;
            if (totalHotelsDB.length > 0)
              totalHotels = totalHotelsDB[0].totalHotels;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            const hotels = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  maxDistance: defaultMeterRange,
                },
              },
              {
                $match: {
                  "address.city": city.toString().toUpperCase(),
                  "address.state": state.toString().toUpperCase(),
                },
              },
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            if (hotels.length === 0) {
              throw new BadRequestError("No Hotels Found");
            }
            res
              .send({
                hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              })
              .status(200);
            return;
          }

          //Only city
          else if (city !== undefined) {
            const totalHotelsDB = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  $maxDistance: defaultMeterRange,
                },
              },
              {
                $match: {
                  "address.city": city.toString().toUpperCase(),
                },
              },
            ]).count("totalHotels");
            let totalHotels = 0;
            if (totalHotelsDB.length > 0)
              totalHotels = totalHotelsDB[0].totalHotels;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }

            const hotels = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  maxDistance: defaultMeterRange,
                },
              },
              {
                $match: {
                  "address.city": city.toString().toUpperCase(),
                },
              },
              { $skip: perPage * page },
              { $limit: perPage },
            ]);
            if (hotels.length === 0) {
              throw new BadRequestError("No Hotels Found");
            }
            res
              .send({
                hotels: hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              })
              .status(200);
            return;
          }

          //search by only state
          else if (state !== undefined) {
            const totalHotelsDB = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  $maxDistance: defaultMeterRange,
                },
              },
              {
                $match: {
                  "address.state": state.toString().toUpperCase(),
                },
              },
            ]).count("totalHotels");
            let totalHotels = 0;
            if (totalHotelsDB.length > 0)
              totalHotels = totalHotelsDB[0].totalHotels;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            const hotels = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  maxDistance: defaultMeterRange,
                },
              },
              {
                $match: {
                  "address.state": state.toString().toUpperCase(),
                },
              },
              { $skip: perPage * page },
              { $limit: perPage },
            ]);
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
        }

        //Within  range defined
        else {
          //Within  range defined
          //city and state
          if (city !== undefined && state !== undefined) {
            const totalHotelsDB = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  $maxDistance: rangeInMeter,
                },
              },
              {
                $match: {
                  "address.city": city.toString().toUpperCase(),
                  "address.state": state.toString().toUpperCase(),
                },
              },
            ]).count("totalHotels");
            let totalHotels = 0;
            if (totalHotelsDB.length > 0)
              totalHotels = totalHotelsDB[0].totalHotels;
            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            const hotels = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  maxDistance: rangeInMeter,
                },
              },
              {
                $match: {
                  "address.city": city.toString().toUpperCase(),
                  "address.state": state.toString().toUpperCase(),
                },
              },
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            if (hotels.length === 0) {
              throw new BadRequestError("No Hotels Found");
            }
            res
              .send({
                hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              })
              .status(200);
            return;
          }

          //Only city
          else if (city !== undefined) {
            const totalHotelsDB = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  $maxDistance: rangeInMeter,
                },
              },
              {
                $match: {
                  "address.city": city.toString().toUpperCase(),
                },
              },
            ]).count("totalHotels");
            let totalHotels = 0;
            if (totalHotelsDB.length > 0)
              totalHotels = totalHotelsDB[0].totalHotels;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            const hotels = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  maxDistance: rangeInMeter,
                },
              },
              {
                $match: {
                  "address.city": city.toString().toUpperCase(),
                },
              },
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            if (hotels.length === 0) {
              throw new BadRequestError("No Hotels Found");
            }
            res
              .send({
                hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              })
              .status(200);
            return;
          }

          //search by only state
          else if (state !== undefined) {
            const totalHotelsDB = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  $maxDistance: rangeInMeter,
                },
              },
              {
                $match: {
                  "address.state": state.toString().toUpperCase(),
                },
              },
            ]).count("totalHotels");
            let totalHotels = 0;
            if (totalHotelsDB.length > 0)
              totalHotels = totalHotelsDB[0].totalHotels;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            const hotels = await Hotel.aggregate([
              {
                $geoNear: {
                  near: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  distanceField: "distanceToReach",
                  maxDistance: rangeInMeter,
                },
              },
              {
                $match: {
                  "address.state": state.toString().toUpperCase(),
                },
              },
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            if (hotels.length === 0) {
              throw new BadRequestError("No Hotels Found");
            }
            res
              .send({
                hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              })
              .status(200);
            return;
          }
        }
      }

      //filter with no geoQuery
      else {
        //Search by both city and state
        if (city !== undefined && state !== undefined) {
          const totalHotelsDB = await Hotel.aggregate([
            {
              $match: {
                "address.city": city.toString().toUpperCase(),
                "address.state": state.toString().toUpperCase(),
              },
            },
          ]).count("totalHotels");
          let totalHotels = 0;
          if (totalHotelsDB.length > 0)
            totalHotels = totalHotelsDB[0].totalHotels;

          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }

          const hotels = await Hotel.aggregate([
            {
              $match: {
                "address.city": city.toString().toUpperCase(),
                "address.state": state.toString().toUpperCase(),
              },
            },
            { $skip: perPage * page },
            { $limit: perPage },
          ]);

          if (hotels.length === 0) {
            throw new BadRequestError("No Hotels Found");
          }
          res
            .send({
              hotels: hotels,
              totalHotels,
              page: page,
              pages: Math.ceil(totalHotels / perPage),
            })
            .status(200);
          return;
        }

        //Search by only city
        else if (city !== undefined) {
          const totalHotelsDB = await Hotel.aggregate([
            {
              $match: {
                "address.city": city.toString().toUpperCase(),
              },
            },
          ]).count("totalHotels");
          let totalHotels = 0;
          if (totalHotelsDB.length > 0)
            totalHotels = totalHotelsDB[0].totalHotels;

          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }

          const hotels = await Hotel.aggregate([
            {
              $match: {
                "address.city": city.toString().toUpperCase(),
              },
            },
            { $skip: perPage * page },
            { $limit: perPage },
          ]);

          if (hotels.length === 0) {
            throw new BadRequestError("No Hotels Found");
          }
          res
            .send({
              hotels: hotels,
              totalHotels,
              page: page,
              pages: Math.ceil(totalHotels / perPage),
            })
            .status(200);
          return;
        }

        //search by only state
        else if (state !== undefined) {
          const totalHotelsDB = await Hotel.aggregate([
            {
              $match: {
                "address.state": state.toString().toUpperCase(),
              },
            },
          ]).count("totalHotels");
          let totalHotels = 0;
          if (totalHotelsDB.length > 0)
            totalHotels = totalHotelsDB[0].totalHotels;

          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }

          const hotels = await Hotel.aggregate([
            {
              $match: {
                "address.state": state.toString().toUpperCase(),
              },
            },
            { $skip: perPage * page },
            { $limit: perPage },
          ]);

          if (hotels.length === 0) {
            throw new BadRequestError("No Hotels Found");
          }
          res
            .send({
              hotels: hotels,
              totalHotels,
              page: page,
              pages: Math.ceil(totalHotels / perPage),
            })
            .status(200);
          return;
        }
      }
    }

    //No Filter
    else {
      //No Filter but Geo Query
      if (isGeoQuery) {
        // @ts-ignore
        const latitude = parseFloat(req.query.latitude);
        // @ts-ignore
        const longitude = parseFloat(req.query.longitude);
        // @ts-ignore
        let rangeKM = req.query.range;
        let rangeInMeter = 0;
        if (!latitude || !longitude) {
          throw new BadRequestError("Latitude and Longitude must be given");
        }

        if (rangeKM !== undefined) {
          // @ts-ignore
          rangeKM = parseFloat(req.query.range);
          //convert km to meter
          // @ts-ignore
          rangeInMeter = rangeKM * 1000;
        }

        //Geo query with undefined range
        if (rangeKM === undefined) {
          //No Within Range
          const totalHotelsDB = await Hotel.aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [longitude, latitude],
                },
                distanceField: "distanceToReach",
                $maxDistance: defaultMeterRange,
              },
            },
          ]).count("totalHotels");
          let totalHotels = 0;
          if (totalHotelsDB.length > 0)
            totalHotels = totalHotelsDB[0].totalHotels;

          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }
          const hotels = await Hotel.aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [longitude, latitude],
                },
                distanceField: "distanceToReach",
                maxDistance: defaultMeterRange,
              },
            },
            { $skip: perPage * page },
            { $limit: perPage },
          ]);

          if (hotels.length === 0) {
            throw new BadRequestError("No Hotels Found");
          }
          res
            .send({
              hotels,
              totalHotels,
              page: page,
              pages: Math.ceil(totalHotels / perPage),
            })
            .status(200);
          return;
        }
        //Geo Query with given range
        else {
          const totalHotelsDB = await Hotel.aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [longitude, latitude],
                },
                distanceField: "distanceToReach",
                $maxDistance: rangeInMeter,
              },
            },
          ]).count("totalHotels");
          let totalHotels = 0;
          if (totalHotelsDB.length > 0)
            totalHotels = totalHotelsDB[0].totalHotels;

          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }
          const hotels = await Hotel.aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [longitude, latitude],
                },
                distanceField: "distanceToReach",
                maxDistance: rangeInMeter,
              },
            },
            { $skip: perPage * page },
            { $limit: perPage },
          ]);

          if (hotels.length === 0) {
            throw new BadRequestError("No Hotels Found");
          }
          res
            .send({
              hotels,
              totalHotels,
              page: page,
              pages: Math.ceil(totalHotels / perPage),
            })
            .status(200);
          return;
        }
      }

      //No Filter No Geo Query
      else {
        const totalHotels = await Hotel.find().countDocuments();
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
        res
          .send({
            hotels: hotels,
            totalHotels,
            page: page,
            pages: Math.ceil(totalHotels / perPage),
          })
          .status(200);
        return;
      }
    }
  }
);

export { router as searchHotelByStateRouter };
