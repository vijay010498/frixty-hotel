import express, { Request, Response } from "express";
import { body, param, query } from "express-validator";
import { BadRequestError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";

//sort rules 1 = ascending, -1 descending
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
    let isSortBy = false;
    let isFilterBy = false;
    let isGeoQuery = false;
    const isFilter_ByString = req.query.isFilterBy || "false ";
    const isGeoQueryString = req.query.isGeoQuery || "false";
    const isSort_ByString = req.query.isSortBy || "false";
    if (isSort_ByString.toString().trim() === "true") isSortBy = true;
    if (isFilter_ByString.toString().trim() === "true") isFilterBy = true;
    if (isGeoQueryString.toString().trim() === "true") isGeoQuery = true;

    let sortCritters = [];
    if (isSortBy) {
      //sort is enabled
      let sortByParam = req.query.sortBy;
      if (sortByParam === undefined) {
        throw new BadRequestError(
          "IF Sort By is enabled sort by parameter must be given. Else disable the isSortBy param == false"
        );
      }
      sortByParam = sortByParam.toString().trim();
      const sortArr = sortByParam.split(" ");
      sortCritters = [];
      for (let i = 0; i < sortArr.length; i = i + 2) {
        sortCritters.push({ type: sortArr[i], rule: parseInt(sortArr[i + 1]) });
      }

      //This is to ensure each sort param can be given once
      let priceCount = 0;
      for (let i = 0; i < sortCritters.length; i++) {
        //check to like sortBy can only contains price or ratings
        /*if (
            sortCritters[i].type !== "price" &&
            sortCritters[i].type !== "rating"
        )*/

        if (sortCritters[i].type !== "price") {
          throw new BadRequestError(
            "Currently This Api Supports only Sorting by Price. Or check the spaces in the query param"
          );
        }
        if (sortCritters[i].rule !== 1 && sortCritters[i].rule !== -1) {
          throw new BadRequestError(
            "Sort Order Must be either 1 for ascending or -1 for descending. Or check the spaces in the query param"
          );
        }
        priceCount++;
      }

      //This is to ensure each sort param can be given once
      if (priceCount > 1) {
        throw new BadRequestError(
          "Each Query parameter can be given only once. Check your request api"
        );
      }
    }

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
            const hotelsDB = await Hotel.aggregate([
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
            ]);
            const totalHotels = hotelsDB.length;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }

            if (isSortBy) {
              let isSortByPrice = false;
              let sortByPriceRule = 1; //default ascending order
              for (let i = 0; i < sortCritters.length; i++) {
                if (sortCritters[i].type === "price") {
                  isSortByPrice = true;
                  sortByPriceRule = sortCritters[i].rule;
                }
              }
              //check for different Sorting
              if (isSortByPrice) {
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
                  {
                    $unwind: {
                      path: "$rooms",
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      root: { $mergeObjects: "$$ROOT" },
                      rooms: { $push: "$rooms" },
                    },
                  },
                  {
                    $replaceRoot: {
                      newRoot: {
                        $mergeObjects: ["$root", "$$ROOT"],
                      },
                    },
                  },
                  {
                    $project: {
                      root: 0,
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
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
            } else {
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
          }

          //Only city
          else if (city !== undefined) {
            const hotelsDB = await Hotel.aggregate([
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
            ]);
            const totalHotels = hotelsDB.length;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            if (isSortBy) {
              let isSortByPrice = false;
              let sortByPriceRule = 1; //default ascending order
              for (let i = 0; i < sortCritters.length; i++) {
                if (sortCritters[i].type === "price") {
                  isSortByPrice = true;
                  sortByPriceRule = sortCritters[i].rule;
                }
              }
              //check for different Sorting
              if (isSortByPrice) {
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
                  {
                    $unwind: {
                      path: "$rooms",
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      root: { $mergeObjects: "$$ROOT" },
                      rooms: { $push: "$rooms" },
                    },
                  },
                  {
                    $replaceRoot: {
                      newRoot: {
                        $mergeObjects: ["$root", "$$ROOT"],
                      },
                    },
                  },
                  {
                    $project: {
                      root: 0,
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
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
            } else {
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
          }

          //search by only state
          else if (state !== undefined) {
            const hotelsDB = await Hotel.aggregate([
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
            ]);
            const totalHotels = hotelsDB.length;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            if (isSortBy) {
              let isSortByPrice = false;
              let sortByPriceRule = 1; //default ascending order
              for (let i = 0; i < sortCritters.length; i++) {
                if (sortCritters[i].type === "price") {
                  isSortByPrice = true;
                  sortByPriceRule = sortCritters[i].rule;
                }
              }
              //check for different Sorting
              if (isSortByPrice) {
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
                  {
                    $unwind: {
                      path: "$rooms",
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      root: { $mergeObjects: "$$ROOT" },
                      rooms: { $push: "$rooms" },
                    },
                  },
                  {
                    $replaceRoot: {
                      newRoot: {
                        $mergeObjects: ["$root", "$$ROOT"],
                      },
                    },
                  },
                  {
                    $project: {
                      root: 0,
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
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
            } else {
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
                  totalHotels,
                  page: page,
                  pages: Math.ceil(totalHotels / perPage),
                })
                .status(200);
              return;
            }
          }
        }

        //Within  range defined
        else {
          //Within  range defined
          //city and state
          if (city !== undefined && state !== undefined) {
            const hotelDB = await Hotel.aggregate([
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
            ]);
            const totalHotels = hotelDB.length;
            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            if (isSortBy) {
              let isSortByPrice = false;
              let sortByPriceRule = 1; //default ascending order
              for (let i = 0; i < sortCritters.length; i++) {
                if (sortCritters[i].type === "price") {
                  isSortByPrice = true;
                  sortByPriceRule = sortCritters[i].rule;
                }
              }
              //check for different Sorting
              if (isSortByPrice) {
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
                  {
                    $unwind: {
                      path: "$rooms",
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      root: { $mergeObjects: "$$ROOT" },
                      rooms: { $push: "$rooms" },
                    },
                  },
                  {
                    $replaceRoot: {
                      newRoot: {
                        $mergeObjects: ["$root", "$$ROOT"],
                      },
                    },
                  },
                  {
                    $project: {
                      root: 0,
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
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
            } else {
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
          }

          //Only city
          else if (city !== undefined) {
            const hotelsDB = await Hotel.aggregate([
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
            ]);
            const totalHotels = hotelsDB.length;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            if (isSortBy) {
              let isSortByPrice = false;
              let sortByPriceRule = 1; //default ascending order
              for (let i = 0; i < sortCritters.length; i++) {
                if (sortCritters[i].type === "price") {
                  isSortByPrice = true;
                  sortByPriceRule = sortCritters[i].rule;
                }
              }
              //check for different Sorting
              if (isSortByPrice) {
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
                  {
                    $unwind: {
                      path: "$rooms",
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      root: { $mergeObjects: "$$ROOT" },
                      rooms: { $push: "$rooms" },
                    },
                  },
                  {
                    $replaceRoot: {
                      newRoot: {
                        $mergeObjects: ["$root", "$$ROOT"],
                      },
                    },
                  },
                  {
                    $project: {
                      root: 0,
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
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
            } else {
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
          }

          //search by only state
          else if (state !== undefined) {
            const hotelsDB = await Hotel.aggregate([
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
            ]);
            let totalHotels = hotelsDB.length;

            if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
              page = 0;
            }
            if (isSortBy) {
              let isSortByPrice = false;
              let sortByPriceRule = 1; //default ascending order
              for (let i = 0; i < sortCritters.length; i++) {
                if (sortCritters[i].type === "price") {
                  isSortByPrice = true;
                  sortByPriceRule = sortCritters[i].rule;
                }
              }
              //check for different Sorting
              if (isSortByPrice) {
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
                  {
                    $unwind: {
                      path: "$rooms",
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      root: { $mergeObjects: "$$ROOT" },
                      rooms: { $push: "$rooms" },
                    },
                  },
                  {
                    $replaceRoot: {
                      newRoot: {
                        $mergeObjects: ["$root", "$$ROOT"],
                      },
                    },
                  },
                  {
                    $project: {
                      root: 0,
                    },
                  },
                  {
                    $sort: {
                      "rooms.priceForOneNight": sortByPriceRule,
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
            } else {
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
      }

      //filter with no geoQuery
      else {
        //Search by both city and state
        if (city !== undefined && state !== undefined) {
          const hotelsDB = await Hotel.aggregate([
            {
              $match: {
                "address.city": city.toString().toUpperCase(),
                "address.state": state.toString().toUpperCase(),
              },
            },
          ]);
          const totalHotels = hotelsDB.length;

          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }

          if (isSortBy) {
            let isSortByPrice = false;
            let sortByPriceRule = 1; //default ascending order
            for (let i = 0; i < sortCritters.length; i++) {
              if (sortCritters[i].type === "price") {
                isSortByPrice = true;
                sortByPriceRule = sortCritters[i].rule;
              }
            }
            //check for different sorting
            if (isSortByPrice) {
              const hotels = await Hotel.aggregate([
                {
                  $match: {
                    "address.city": city.toString().toUpperCase(),
                    "address.state": state.toString().toUpperCase(),
                  },
                },
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
                  },
                },
                {
                  $group: {
                    _id: "$_id",
                    root: { $mergeObjects: "$$ROOT" },
                    rooms: { $push: "$rooms" },
                  },
                },
                {
                  $replaceRoot: {
                    newRoot: {
                      $mergeObjects: ["$root", "$$ROOT"],
                    },
                  },
                },
                {
                  $project: {
                    root: 0,
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
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
          } else {
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
        }

        //Search by only city
        else if (city !== undefined) {
          const hotelsDB = await Hotel.aggregate([
            {
              $match: {
                "address.city": city.toString().toUpperCase(),
              },
            },
          ]);

          const totalHotels = hotelsDB.length;

          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }

          if (isSortBy) {
            let isSortByPrice = false;
            let sortByPriceRule = 1; //default ascending order
            for (let i = 0; i < sortCritters.length; i++) {
              if (sortCritters[i].type === "price") {
                isSortByPrice = true;
                sortByPriceRule = sortCritters[i].rule;
              }
            }
            //check for different sorting
            if (isSortByPrice) {
              const hotels = await Hotel.aggregate([
                {
                  $match: {
                    "address.city": city.toString().toUpperCase(),
                  },
                },
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
                  },
                },
                {
                  $group: {
                    _id: "$_id",
                    root: { $mergeObjects: "$$ROOT" },
                    rooms: { $push: "$rooms" },
                  },
                },
                {
                  $replaceRoot: {
                    newRoot: {
                      $mergeObjects: ["$root", "$$ROOT"],
                    },
                  },
                },
                {
                  $project: {
                    root: 0,
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
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
          } else {
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
        }

        //search by only state
        else if (state !== undefined) {
          const hotelsDB = await Hotel.aggregate([
            {
              $match: {
                "address.state": state.toString().toUpperCase(),
              },
            },
          ]);
          const totalHotels = hotelsDB.length;
          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }

          if (isSortBy) {
            let isSortByPrice = false;
            let sortByPriceRule = 1; //default ascending order
            for (let i = 0; i < sortCritters.length; i++) {
              if (sortCritters[i].type === "price") {
                isSortByPrice = true;
                sortByPriceRule = sortCritters[i].rule;
              }
            }
            //check for different sorting
            if (isSortByPrice) {
              const hotels = await Hotel.aggregate([
                {
                  $match: {
                    "address.state": state.toString().toUpperCase(),
                  },
                },
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
                  },
                },
                {
                  $group: {
                    _id: "$_id",
                    root: { $mergeObjects: "$$ROOT" },
                    rooms: { $push: "$rooms" },
                  },
                },
                {
                  $replaceRoot: {
                    newRoot: {
                      $mergeObjects: ["$root", "$$ROOT"],
                    },
                  },
                },
                {
                  $project: {
                    root: 0,
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
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
          } else {
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
    }

    //No Filter
    else {
      //No Filter but Geo Query
      if (isGeoQuery) {
        // @ts-ignore
        const latitude = parseFloat(req.query.latitude);
        // @ts-ignore
        const longitude = parseFloat(req.query.longitude);
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

        //Geo query with undefined range //completed
        if (rangeKM === undefined) {
          //No Within Range

          const hotelsDB = await Hotel.aggregate([
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
          ]);
          let totalHotels = hotelsDB.length;
          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }

          if (isSortBy) {
            let isSortByPrice = false;
            let sortByPriceRule = 1; //default ascending order
            for (let i = 0; i < sortCritters.length; i++) {
              if (sortCritters[i].type === "price") {
                isSortByPrice = true;
                sortByPriceRule = sortCritters[i].rule;
              }
            }

            //check for different Sorting
            if (isSortByPrice) {
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
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
                  },
                },
                {
                  $group: {
                    _id: "$_id",
                    root: { $mergeObjects: "$$ROOT" },
                    rooms: { $push: "$rooms" },
                  },
                },
                {
                  $replaceRoot: {
                    newRoot: {
                      $mergeObjects: ["$root", "$$ROOT"],
                    },
                  },
                },
                {
                  $project: {
                    root: 0,
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
                  },
                },
                { $skip: perPage * page },
                { $limit: perPage },
              ]);
              if (hotels.length === 0) {
                throw new BadRequestError("No Hotels Found");
              }
              // @ts-ignore
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
          //without sorting
          else {
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
        }

        //Geo Query with given range //completed testing
        else {
          const hotelsDB = await Hotel.aggregate([
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
          ]);
          let totalHotels = hotelsDB.length;
          if (page >= Math.ceil(totalHotels / perPage) || page < 0) {
            page = 0;
          }

          if (isSortBy) {
            let isSortByPrice = false;
            let sortByPriceRule = 1; //default ascending order
            for (let i = 0; i < sortCritters.length; i++) {
              if (sortCritters[i].type === "price") {
                isSortByPrice = true;
                sortByPriceRule = sortCritters[i].rule;
              }
            }
            if (isSortByPrice) {
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
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
                  },
                },
                {
                  $group: {
                    _id: "$_id",
                    root: { $mergeObjects: "$$ROOT" },
                    rooms: { $push: "$rooms" },
                  },
                },
                {
                  $replaceRoot: {
                    newRoot: {
                      $mergeObjects: ["$root", "$$ROOT"],
                    },
                  },
                },
                {
                  $project: {
                    root: 0,
                  },
                },
                {
                  $sort: {
                    "rooms.priceForOneNight": sortByPriceRule,
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

          //without sort //completed testing
          else {
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
      }

      //No Filter No Geo Query //completed testing
      else {
        const totalHotels = await Hotel.find().countDocuments();
        if (page >= Math.ceil(totalHotels / perPage)) {
          page = 0;
        }

        // Sort
        if (isSortBy) {
          let isSortByPrice = false;
          let sortByPriceRule = 1; //default ascending order
          for (let i = 0; i < sortCritters.length; i++) {
            if (sortCritters[i].type === "price") {
              isSortByPrice = true;
              sortByPriceRule = sortCritters[i].rule;
            }
          }

          //check for different sorting
          if (isSortByPrice) {
            const hotels = await Hotel.aggregate([
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $sort: {
                  "rooms.priceForOneNight": sortByPriceRule,
                },
              },
              {
                $group: {
                  _id: "$_id",
                  root: { $mergeObjects: "$$ROOT" },
                  rooms: { $push: "$rooms" },
                },
              },
              {
                $replaceRoot: {
                  newRoot: {
                    $mergeObjects: ["$root", "$$ROOT"],
                  },
                },
              },
              {
                $project: {
                  root: 0,
                },
              },
              {
                $sort: {
                  "rooms.priceForOneNight": sortByPriceRule,
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

        //No sorting
        else {
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
  }
);

export { router as searchHotelByStateRouter };
