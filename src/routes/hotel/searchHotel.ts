import express, { Request, Response } from "express";
import { BadRequestError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";
import { exchangeRates } from "exchange-rates-api";
import { SupportedCurrencies } from "../../models/enums/supportedCurrencies";

const router = express.Router();
const defaultMeterRange = 5 * 1000; //default nearBy distance is 5KM or 5000 meter
const perPage = 10; //
const defaultCurrency = "MYR";
let currencyRates = {};
let requestedCurrency: string;

router.get(
  "/api/v1/hotels/search",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    //first get currency exchange rates
    try {
      //simple cache
      if (Object.getOwnPropertyNames(currencyRates).length === 0) {
        console.log("Cache is null calling api again");
        currencyRates = await exchangeRates().latest().base("MYR").fetch();
      } else console.log("Exchange rates used from simple In-Memory cache ");
    } catch (err) {
      console.error(err);
      res.status(403).send("Something Went wrong");
    }

    //currency query param
    // @ts-ignore
    requestedCurrency = req.query.currency || defaultCurrency;

    //check if given currency is supported by us or not
    // @ts-ignore
    if (requestedCurrency !== defaultCurrency) {
      if (
        // @ts-ignore
        Object.values(SupportedCurrencies).indexOf(requestedCurrency) === -1
      ) {
        throw new BadRequestError(`${requestedCurrency} is not supported`);
      }
    }

    // @ts-ignore
    let page = parseInt(req.query.page) || 0;
    // @ts-ignore
    const totalGuests = parseInt(req.query.totalGuests) || 2;
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
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
                    $match: {
                      "rooms.sleeps": { $gte: totalGuests },
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

                await transformObject(hotels);

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
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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
                { $skip: perPage * page },
                { $limit: perPage },
              ]);
              await transformObject(hotels);

              if (hotels.length === 0) {
                throw new BadRequestError("No Hotels Found");
              }
              res.status(200).send({
                hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              });
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
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
                    $match: {
                      "rooms.sleeps": { $gte: totalGuests },
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

                await transformObject(hotels);

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
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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
                { $skip: perPage * page },
                { $limit: perPage },
              ]);

              await transformObject(hotels);

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
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
                    $match: {
                      "rooms.sleeps": { $gte: totalGuests },
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

                await transformObject(hotels);

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
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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
                { $skip: perPage * page },
                { $limit: perPage },
              ]);

              await transformObject(hotels);

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
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
                    $match: {
                      "rooms.sleeps": { $gte: totalGuests },
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

                await transformObject(hotels);

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
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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
                { $skip: perPage * page },
                { $limit: perPage },
              ]);

              await transformObject(hotels);

              if (hotels.length === 0) {
                throw new BadRequestError("No Hotels Found");
              }
              res.status(200).send({
                hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              });
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
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
                    $match: {
                      "rooms.sleeps": { $gte: totalGuests },
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

                await transformObject(hotels);

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
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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
                { $skip: perPage * page },
                { $limit: perPage },
              ]);

              await transformObject(hotels);

              if (hotels.length === 0) {
                throw new BadRequestError("No Hotels Found");
              }
              res.status(200).send({
                hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              });
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
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
                    $match: {
                      "rooms.sleeps": { $gte: totalGuests },
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

                await transformObject(hotels);

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
                {
                  $unwind: {
                    path: "$rooms",
                  },
                },
                {
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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
                { $skip: perPage * page },
                { $limit: perPage },
              ]);

              await transformObject(hotels);

              if (hotels.length === 0) {
                throw new BadRequestError("No Hotels Found");
              }
              res.status(200).send({
                hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              });
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
            {
              $unwind: {
                path: "$rooms",
              },
            },
            {
              $match: {
                "rooms.sleeps": { $gte: totalGuests },
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
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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

              await transformObject(hotels);

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
            }
          } else {
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
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            await transformObject(hotels);

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
            {
              $unwind: {
                path: "$rooms",
              },
            },
            {
              $match: {
                "rooms.sleeps": { $gte: totalGuests },
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
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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

              await transformObject(hotels);

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
            }
          } else {
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
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            await transformObject(hotels);

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
            {
              $unwind: {
                path: "$rooms",
              },
            },
            {
              $match: {
                "rooms.sleeps": { $gte: totalGuests },
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
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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

              await transformObject(hotels);

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
            }
          } else {
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
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            await transformObject(hotels);

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
            {
              $unwind: {
                path: "$rooms",
              },
            },
            {
              $match: {
                "rooms.sleeps": { $gte: totalGuests },
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
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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

              await transformObject(hotels);

              if (hotels.length === 0) {
                throw new BadRequestError("No Hotels Found");
              }
              // @ts-ignore
              res.status(200).send({
                hotels: hotels,
                totalHotels,
                page: page,
                pages: Math.ceil(totalHotels / perPage),
              });
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
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            await transformObject(hotels);

            if (hotels.length === 0) {
              throw new BadRequestError("No Hotels Found");
            }
            res.status(200).send({
              hotels,
              totalHotels,
              page: page,
              pages: Math.ceil(totalHotels / perPage),
            });
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
            {
              $unwind: {
                path: "$rooms",
              },
            },
            {
              $match: {
                "rooms.sleeps": { $gte: totalGuests },
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
                  $match: {
                    "rooms.sleeps": { $gte: totalGuests },
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

              await transformObject(hotels);

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
              {
                $unwind: {
                  path: "$rooms",
                },
              },
              {
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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
              { $skip: perPage * page },
              { $limit: perPage },
            ]);

            await transformObject(hotels);

            if (hotels.length === 0) {
              throw new BadRequestError("No Hotels Found");
            }
            res.status(200).send({
              hotels,
              totalHotels,
              page: page,
              pages: Math.ceil(totalHotels / perPage),
            });
            return;
          }
        }
      }

      //No Filter No Geo Query //completed testing
      else {
        const hotelsDB = await Hotel.aggregate([
          {
            $unwind: {
              path: "$rooms",
            },
          },
          {
            $match: {
              "rooms.sleeps": { $gte: totalGuests },
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
        ]);
        let totalHotels = hotelsDB.length;
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
                $match: {
                  "rooms.sleeps": { $gte: totalGuests },
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

            await transformObject(hotels);

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
          }
        }

        //No sorting
        else {
          const hotels = await Hotel.aggregate([
            {
              $unwind: {
                path: "$rooms",
              },
            },
            {
              $match: {
                "rooms.sleeps": { $gte: totalGuests },
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
            { $skip: perPage * page },
            { $limit: perPage },
          ]);
          await transformObject(hotels);
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
        }
      }
    }
  }
);

const transformObject = (hotels: Array<any>) => {
  for (let i = 0; i < hotels.length; i++) {
    hotels[i].currency = requestedCurrency;
    if (hotels[i].rooms) {
      hotels[i].totalRoomsAvailable = hotels[i].rooms.length;
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        hotels[i].rooms[j].id = hotels[i].rooms[j]._id;
        delete hotels[i].rooms[j]._id;
        if (requestedCurrency !== hotels[i].homeCurrency) {
          hotels[i].rooms[j].priceForOneNight = convertCurrency(
            requestedCurrency,
            hotels[i].rooms[j].priceForOneNight
          );
        }
      }
    }
    if (hotels[i].distanceToReach) {
      hotels[i].distanceToReach = parseFloat(
        (hotels[i].distanceToReach / 1000).toFixed(2)
      );
    }
    hotels[i].id = hotels[i]._id;
    delete hotels[i]._id;
    delete hotels[i].__v;
    const createdDateIso = hotels[i].createdAt;
    delete hotels[i].createdAt;
    hotels[i].createdAt = createdDateIso.getTime();
    const updatedAtISO = hotels[i].updatedAt;
    delete hotels[i].updatedAt;
    hotels[i].updatedAt = updatedAtISO.getTime();
  }
};

const convertCurrency = function (currency: string, amount: number) {
  switch (currency) {
    case "AUD":
      // @ts-ignore
      const oneMYRRate = currencyRates.AUD.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "GBP":
      // @ts-ignore
      const oneMYRRate = currencyRates.GBP.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "BGN":
      // @ts-ignore
      const oneMYRRate = currencyRates.BGN.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "CAD":
      // @ts-ignore
      const oneMYRRate = currencyRates.CAD.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "CNY":
      // @ts-ignore
      const oneMYRRate = currencyRates.CNY.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "HRK":
      // @ts-ignore
      const oneMYRRate = currencyRates.HRK.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "CZK":
      // @ts-ignore
      const oneMYRRate = currencyRates.CZK.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "DKK":
      // @ts-ignore
      const oneMYRRate = currencyRates.DKK.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "EUR":
      // @ts-ignore
      const oneMYRRate = currencyRates.EUR.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "HKD":
      // @ts-ignore
      const oneMYRRate = currencyRates.HKD.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "HUF":
      // @ts-ignore
      const oneMYRRate = currencyRates.HUF.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "ISK":
      // @ts-ignore
      const oneMYRRate = currencyRates.ISK.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "IDR":
      // @ts-ignore
      const oneMYRRate = currencyRates.IDR.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "INR":
      // @ts-ignore
      const oneMYRRate = currencyRates.INR.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "ILS":
      // @ts-ignore
      const oneMYRRate = currencyRates.ILS.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "JPY":
      // @ts-ignore
      const oneMYRRate = currencyRates.JPY.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "MYR":
      // @ts-ignore
      const oneMYRRate = currencyRates.MYR.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "MXN":
      // @ts-ignore
      const oneMYRRate = currencyRates.MXN.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "NZD":
      // @ts-ignore
      const oneMYRRate = currencyRates.NZD.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "NOK":
      // @ts-ignore
      const oneMYRRate = currencyRates.NOK.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "PHP":
      // @ts-ignore
      const oneMYRRate = currencyRates.PHP.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "PLN":
      // @ts-ignore
      const oneMYRRate = currencyRates.PLN.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "RON":
      // @ts-ignore
      const oneMYRRate = currencyRates.RON.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "RUB":
      // @ts-ignore
      const oneMYRRate = currencyRates.RUB.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "SGD":
      // @ts-ignore
      const oneMYRRate = currencyRates.SGD.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "ZAR":
      // @ts-ignore
      const oneMYRRate = currencyRates.ZAR.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "KRW":
      // @ts-ignore
      const oneMYRRate = currencyRates.KRW.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "SEK":
      // @ts-ignore
      const oneMYRRate = currencyRates.SEK.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "CHF":
      // @ts-ignore
      const oneMYRRate = currencyRates.CHF.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "THB":
      // @ts-ignore
      const oneMYRRate = currencyRates.THB.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "TRY":
      // @ts-ignore
      const oneMYRRate = currencyRates.TRY.toFixed(2);
      return Math.floor(amount * oneMYRRate);
    case "USD":
      // @ts-ignore
      const oneMYRRate = currencyRates.USD.toFixed(2);
      return Math.floor(amount * oneMYRRate);
  }
};

export { router as searchHotelByStateRouter };
