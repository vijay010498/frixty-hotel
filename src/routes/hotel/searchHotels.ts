import express, { Request, Response } from "express";
import { BadRequestError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";
import { exchangeRates } from "exchange-rates-api";
import { SupportedCurrencies } from "../../models/enums/supportedCurrencies";
import { GatewayCharge } from "../../models/GatewayCharges";
import { Booking } from "../../models/Booking";

const router = express.Router();
const defaultMeterRange = 5 * 1000; //default nearBy distance is 5KM or 5000 meter
const perPage = 10; //
const defaultCurrency = "MYR";
const defaultTotalGuests = 1;
let gatewayChargesForHotelPercentage: number;
let currencyRates = {};
let requestedCurrency: string;

let checkIn: string;
let checkOut: string;

router.get(
  "/api/v1/hotels/search",
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 3600 * 1000 * 24)
      .toISOString()
      .slice(0, 10);

    //check for checkin and check out dates
    // @ts-ignore
    checkIn = req.query.checkIn || today;
    // @ts-ignore
    checkOut = req.query.checkOut || tomorrow;
    await checkCheckInAndCheckOutDateQuery(checkIn, checkOut);

    //get Gateway charges percentage
    await getGatewayCharges(res);

    // @ts-ignore
    requestedCurrency = req.query.currency || defaultCurrency;
    //check if given currency is supported by us or not
    if (requestedCurrency !== defaultCurrency)
      await checkRequestedCurrency(requestedCurrency);

    //first get currency exchange rates for user requested currency
    // - > user wants in INR , get one INR  = ? for all currency
    // later divide from home currency of  hotel
    await getCurrencyRates(res);

    // @ts-ignore
    let page = parseInt(req.query.page) || 0;
    // @ts-ignore
    const totalGuests = parseInt(req.query.totalGuests) || defaultTotalGuests;
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
                await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);
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
                await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
                await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
                await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
                await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
                await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
            await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
            await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
            await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
            await checkBookingDetails(hotels);

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
              await checkBookingDetails(hotels);

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
            await checkBookingDetails(hotels);

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
            await checkBookingDetails(hotels);

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
          await checkBookingDetails(hotels);
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

const checkBookingDetails = async (hotels: Array<any>) => {
  let hotelsIds = [];
  let roomIds = [];
  let checkInArr = checkIn.split(",");
  let checkOutArr = checkOut.split(",");
  for (let i = 0; i < hotels.length; i++) {
    hotelsIds.push(hotels[i].id);
    for (let j = 0; j < hotels[i].rooms.length; j++) {
      roomIds.push(hotels[i].rooms[j].id);
    }
  }

  try {
    const bookingsChecked = await Booking.aggregate([
      {
        $match: {
          $and: [{ hotelId: { $in: hotelsIds } }, { roomId: { $in: roomIds } }],
        },
      },
      {
        $addFields: {
          stringCheckInDate: {
            $dateToString: {
              date: "$bookingDetails.checkInDateTime",
              format: "%Y-%m-%d",
            },
          },
          stringCheckOutDate: {
            $dateToString: {
              date: "$bookingDetails.checkOutDateTime",
              format: "%Y-%m-%d",
            },
          },
        },
      },
      {
        $match: {
          $and: [
            {
              $or: [
                { stringCheckInDate: { $in: checkInArr } },
                { stringCheckOutDate: { $in: checkOutArr } },
              ],
            },
            { "bookingDetails.bookingStatus": { $eq: "confirmed" } },
          ],
        },
      },
    ]);

    //execute only any data found in bookings collection
    if (bookingsChecked.length > 0) {
      //Now remove the rooms from this array
      for (let i = 0; i < hotels.length; i++) {
        for (let j = 0; j < hotels[i].rooms.length; j++) {
          for (let k = 0; k < bookingsChecked.length; k++) {
            if (
              hotels[i].rooms[j].id.toString() ===
              bookingsChecked[k].roomId.toString()
            ) {
              console.log(
                ` Match Found ${hotels[i].id}  ${hotels[i].rooms[j].id} ${bookingsChecked[k].roomId} `
              );
              delete hotels[i].rooms[j];
              // @ts-ignore
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
    return;
  }
};

const transformObject = async (hotels: Array<any>) => {
  for (let i = 0; i < hotels.length; i++) {
    hotels[i].currency = requestedCurrency;
    if (hotels[i].rooms) {
      hotels[i].totalRoomsAvailable = hotels[i].rooms.length;
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        hotels[i].rooms[j].id = hotels[i].rooms[j]._id;
        delete hotels[i].rooms[j]._id;

        //add gateway charges to hotel room price
        hotels[i].rooms[j].priceForOneNight += await Math.ceil(
          (gatewayChargesForHotelPercentage / 100) *
            hotels[i].rooms[j].priceForOneNight
        );

        //price conversion
        // @ts-ignore
        hotels[i].rooms[j].priceForOneNight = await Math.floor(
          hotels[i].rooms[j].priceForOneNight / // @ts-ignore
            currencyRates[hotels[i].homeCurrency].toFixed(2)
        );
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

async function checkCheckInAndCheckOutDateQuery(
  checkIn: string,
  checkOut: string
) {
  if (checkIn.split("").length !== 10 || checkOut.split("").length !== 10) {
    throw new BadRequestError(
      "CheckIn or CheckOut Date format must be YYYY-MM-DD"
    );
  }
}
async function getGatewayCharges(res: Response) {
  try {
    const gatewayCharges = await GatewayCharge.find({}).limit(1);
    gatewayCharges.length === 0
      ? (gatewayChargesForHotelPercentage = 5)
      : (gatewayChargesForHotelPercentage = gatewayCharges[0].percentage);
  } catch (err) {
    console.error(err);
    res.status(403).send(err);
    return;
  }
}

async function checkRequestedCurrency(requestedCurrency: string) {
  // @ts-ignore
  if (Object.values(SupportedCurrencies).indexOf(requestedCurrency) === -1) {
    throw new BadRequestError(`${requestedCurrency} is not supported`);
  }
}

async function getCurrencyRates(res: Response) {
  try {
    currencyRates = await exchangeRates()
      .latest()
      .base(requestedCurrency)
      .fetch();
  } catch (err) {
    console.error(err);
    res.status(403).send("Something Went Wrong : Currency Rates");
  }
}

export { router as searchHotelRouter };
