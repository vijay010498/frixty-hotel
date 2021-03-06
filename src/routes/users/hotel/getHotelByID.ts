import express, { Request, Response } from "express";
import { param } from "express-validator";

import { BadRequestError, validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";
import { SupportedCurrencies } from "../../../models/enums/supportedCurrencies";
import { Charges } from "../../../models/Charges";
import { Booking } from "../../../models/Booking";
import { checkHotelExists } from "../../../errors/middleware/hotel-exists";
import mongoose from "mongoose";
import _ from "lodash";
import moment from "moment";
import { ExchangeRatesCache } from "../../../models/Cache/ExchangeRatesCache";
import axios from "axios";

const keys = require("../../../config/keys");
const router = express.Router();
const DEFAULT_CURRENCY = "MYR";
const DEFAULT_TOTAL_GUESTS = 1;
let totalExtraChargesPercentage = 0;
const DEFAULT_SORT_ORDER = 1;
let currencyRates = {};
let requestedCurrency: string;
let checkIn: string;
let checkOut: string;
let totalDays: number;
let totalGuests: number;
let rooms: number;
let roomConfig: string;
let totalAmount: number;
let selected_roomId: string;

router.get(
  "/api/v1/hotel/:hotelId",
  checkHotelExists,
  [param("hotelId").isMongoId().withMessage("Id Must Be String")],
  validateRequest,
  async (req: Request, res: Response) => {
    //total charges
    await getCharges(res);
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 3600 * 1000 * 24)
      .toISOString()
      .slice(0, 10);
    //check for checkin and check out dates
    // @ts-ignore
    checkIn = req.query.checkIn || today;
    // @ts-ignore
    checkOut = req.query.checkOut || tomorrow;

    //rooms config
    // @ts-ignore
    rooms = parseInt(req.query.rooms) || 0;
    // @ts-ignore
    selected_roomId = req.query.selected_roomId || "";
    roomConfig = "";
    totalAmount = 0.0;

    //To Calculate total days
    const checkInStr = new Date(checkIn);
    const checkOutStr = new Date(checkOut);
    totalDays =
      (checkOutStr.getTime() - checkInStr.getTime()) / (1000 * 60 * 60 * 24);
    await checkCheckInAndCheckOutDateQuery(checkIn, checkOut);
    // @ts-ignore
    requestedCurrency = req.query.currency || DEFAULT_CURRENCY;
    //check if given currency is supported by us or not
    if (requestedCurrency !== DEFAULT_CURRENCY)
      await checkRequestedCurrency(requestedCurrency);
    //first get currency exchange rates for user requested currency
    // - > user wants in INR , get one INR  = ? for all currency
    // later divide from home currency of  hotel
    await getCurrencyRates(res);
    // @ts-ignore
    totalGuests = parseInt(req.query.totalGuests) || DEFAULT_TOTAL_GUESTS;
    if (totalGuests < 0) {
      throw new BadRequestError("Not a valid room config");
    }

    //first get hotel to get room Id for matching total guest

    const hotels = await Hotel.aggregate([
      {
        $match: {
          // @ts-ignore
          _id: mongoose.Types.ObjectId(req.params.hotelId),
          isServiceable: true,
          isBlockedByAdmin: false,
          adminSubscribed: true,
        },
      },
      {
        $unwind: {
          path: "$rooms",
        },
      },
      {
        $match: {
          //"rooms.sleeps": { $gte: totalGuests },
          "rooms.sleeps": { $gte: 1 },
          isServiceable: true,
        },
      },
      {
        $sort: {
          "rooms.priceForOneNight": DEFAULT_SORT_ORDER,
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

    await transformObject(hotels);
    await checkBookingDetails(hotels);
    await createRoomConfig(hotels, totalGuests, selected_roomId);
    await checkTotalGuestsDetails(hotels);
    if (hotels.length === 0 || !hotels[0].rooms) {
      throw new BadRequestError("Given request is not valid with this hotel");
    }

    await sendResponse(res, hotels);
    return;
  }
);

async function sendResponse(res: Response, hotel: Array<any>) {
  res.status(200).send({
    hotel,
    checkIn,
    checkOut,
    totalDays,
    totalGuests,
    rooms,
    totalAmount,
    roomConfig,
    selected_roomId,
  });
}
const transformObject = async (hotels: Array<any>) => {
  for (let i = 0; i < hotels.length; i++) {
    if (hotels[i].rooms) {
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        let discountPercentage = 0;
        hotels[i].rooms[j].id = hotels[i].rooms[j]._id;
        delete hotels[i].rooms[j]._id;

        //add total charges percentage
        hotels[i].rooms[j].priceForOneNight += await Math.ceil(
          (totalExtraChargesPercentage / 100) *
            hotels[i].rooms[j].priceForOneNight
        );

        hotels[i].rooms[j].priceForOneNightWithoutDiscount =
          hotels[i].rooms[j].priceForOneNight;
        //add discount logic
        if (hotels[i].rooms[j].discount.isDiscount) {
          //Yes There is some discount
          discountPercentage = hotels[i].rooms[j].discount.discountPercentage;
          hotels[i].rooms[j].priceForOneNight -=
            (discountPercentage / 100) * hotels[i].rooms[j].priceForOneNight;
        }

        //price conversion
        hotels[i].rooms[j].priceForOneNight = await convertPrice(
          hotels[i].rooms[j].priceForOneNight,
          hotels[i].homeCurrency
        );

        hotels[i].rooms[j].priceForOneNightWithoutDiscount = await convertPrice(
          hotels[i].rooms[j].priceForOneNightWithoutDiscount,
          hotels[i].homeCurrency
        );

        //Multiply priceForOneNight with totalDays
        hotels[i].rooms[j].price =
          hotels[i].rooms[j].priceForOneNight * totalDays;

        hotels[i].rooms[j].priceWithoutDiscount =
          hotels[i].rooms[j].priceForOneNightWithoutDiscount * totalDays;

        //added discounted amount if
        if (hotels[i].rooms[j].discount.isDiscount) {
          hotels[i].rooms[j].discount.totalDiscountAmount = Math.ceil(
            (hotels[i].rooms[j].discount.discountPercentage / 100) *
              hotels[i].rooms[j].priceWithoutDiscount
          );
        } else {
          hotels[i].rooms[j].discount.totalDiscountAmount = 0;
        }
      }
    }

    //Distance conversion from meter to km only if geo query is enable
    if (hotels[i].distanceToReach) {
      hotels[i].distanceToReach = parseFloat(
        (hotels[i].distanceToReach / 1000).toFixed(2)
      );
    }
    hotels[i].currency = requestedCurrency;
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
const checkBookingDetails = async (hotels: Array<any>) => {
  let hotelsIds = [];
  let roomIds = [];
  for (let i = 0; i < hotels.length; i++) {
    hotelsIds.push(hotels[i].id);
    for (let j = 0; j < hotels[i].rooms.length; j++) {
      roomIds.push(hotels[i].rooms[j].id);
    }
  }
  const dateRange = await getDateRange(checkIn, checkOut);
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
                { stringCheckInDate: { $in: dateRange } },
                { stringCheckOutDate: { $in: dateRange } },
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
              hotels[i].rooms[j].totalRooms -= 1;
              if (hotels[i].rooms[j].totalRooms === 0) {
                console.log(
                  ` Match Found total rooms = 0  delete room itself ${hotels[i].id}  ${hotels[i].rooms[j].id} ${bookingsChecked[k].roomId} `
                );
                hotels[i].rooms.splice(j, 1);
              } else {
                console.log(
                  ` Match Found minus 1 room ${hotels[i].id}  ${hotels[i].rooms[j].id} ${bookingsChecked[k].roomId} `
                );
              }
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
async function createRoomConfig(
  hotels: Array<any>,
  totalGuests: number,
  roomId: String
) {
  //room id given
  if (roomId) {
    //do checking for only selected room id
    let totalRooms = 0;
    for (let i = 0; i < hotels.length; i++) {
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        if (hotels[i].rooms[j].id.toString() === roomId) {
          if (
            totalGuests >
            hotels[i].rooms[j].sleeps * hotels[i].rooms[j].totalRooms
          )
            throw new BadRequestError("No valid Room Config");
          if (hotels[i].rooms[j].sleeps === totalGuests) {
            //if single room has sleeps of === totalGuests
            totalRooms++;
            selected_roomId = hotels[i].rooms[j].id;
            rooms = 1;
            totalAmount = rooms * hotels[i].rooms[j].price;
            roomConfig = `${totalRooms}-${
              hotels[i].rooms[j].sleeps
            }_${await loopRoomConfig(totalRooms, hotels[i].rooms[j].sleeps)}`;
            return;
          } else if (hotels[i].rooms[j].sleeps > totalGuests) {
            totalRooms++;
            selected_roomId = hotels[i].rooms[j].id;
            rooms = 1;
            totalAmount = rooms * hotels[i].rooms[j].price;
            roomConfig = `${totalRooms}-${
              hotels[i].rooms[j].sleeps
            }_${await loopRoomConfig(totalRooms, hotels[i].rooms[j].sleeps)}`;
            return;
          } else if (
            hotels[i].rooms[j].sleeps * hotels[i].rooms[j].totalRooms >=
            totalGuests
          ) {
            totalRooms = Math.ceil(totalGuests / hotels[i].rooms[j].sleeps);
            selected_roomId = hotels[i].rooms[j].id;
            rooms = totalRooms;
            totalAmount = rooms * hotels[i].rooms[j].price;
            roomConfig = `${totalRooms}-${
              hotels[i].rooms[j].sleeps
            }_${await loopRoomConfig(totalRooms, hotels[i].rooms[j].sleeps)}`;
            return;
          }
        }
      }
    }
  } else {
    let totalRooms = 0;
    //possibly default room config so go through all rooms
    for (let i = 0; i < hotels.length; i++) {
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        if (hotels[i].rooms[j].sleeps === totalGuests) {
          //if single room has sleeps of === totalGuests
          totalRooms++;
          selected_roomId = hotels[i].rooms[j].id;
          rooms = 1;
          totalAmount = rooms * hotels[i].rooms[j].price;
          roomConfig = `${totalRooms}-${
            hotels[i].rooms[j].sleeps
          }_${await loopRoomConfig(totalRooms, hotels[i].rooms[j].sleeps)}`;
          return;
        }
      }
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        if (hotels[i].rooms[j].sleeps > totalGuests) {
          totalRooms++;
          selected_roomId = hotels[i].rooms[j].id;
          rooms = 1;
          totalAmount = rooms * hotels[i].rooms[j].price;
          roomConfig = `${totalRooms}-${
            hotels[i].rooms[j].sleeps
          }_${await loopRoomConfig(totalRooms, hotels[i].rooms[j].sleeps)}`;
          return;
        }
      }
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        if (
          hotels[i].rooms[j].sleeps * hotels[i].rooms[j].totalRooms >=
          totalGuests
        ) {
          totalRooms = Math.ceil(totalGuests / hotels[i].rooms[j].sleeps);
          selected_roomId = hotels[i].rooms[j].id;
          rooms = totalRooms;
          totalAmount = rooms * hotels[i].rooms[j].price;
          roomConfig = `${totalRooms}-${
            hotels[i].rooms[j].sleeps
          }_${await loopRoomConfig(totalRooms, hotels[i].rooms[j].sleeps)}`;
          return;
        }
      }
    }
  }
}

async function checkTotalGuestsDetails(hotels: Array<any>) {
  //
  for (let i = 0; i < hotels.length; i++) {
    await _.remove(hotels[i].rooms, function (room) {
      // @ts-ignore
      return totalGuests > room.totalRooms * room.sleeps;
    });
  }
  await _.remove(hotels, function (hotel) {
    return hotel.rooms.length === 0;
  });
  for (let i = 0; i < hotels.length; i++) {
    hotels[i].totalRoomTypesAvailable = hotels[i].rooms.length;
  }
}
function loopRoomConfig(totalRooms: number, sleeps: number) {
  let config = "";
  for (let i = 0; i < totalRooms; i++) {
    i > 0 ? (config += "_") : null;
    config += `${i + 1}-${sleeps}`;
  }
  return config;
}

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

async function getCharges(res: Response) {
  try {
    const charges = await Charges.aggregate([
      {
        $match: {
          isApplicable: true,
        },
      },
    ]);
    let totalChargesPercentage = 0;
    if (charges && charges.length > 0) {
      for (let i = 0; i < charges.length; i++) {
        totalChargesPercentage += charges[i].percentage;
      }
    }

    totalExtraChargesPercentage = totalChargesPercentage;
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
    //check from mongo db first
    const exchangeRatesCache = await ExchangeRatesCache.findOne({
      base: requestedCurrency,
    });
    if (!exchangeRatesCache) {
      //no cache
      console.log("Currency Rates Not Serving from cache");
      const response = await axios.get(
        "https://api.exchangeratesapi.io/latest",
        {
          params: {
            access_key: keys.exchangeRatesApi,
            base: requestedCurrency,
          },
        }
      );
      const saveExchangeRatesCache = ExchangeRatesCache.build({
        base: requestedCurrency,
        rates: response.data.rates,
      });
      await saveExchangeRatesCache.save();
      currencyRates = response.data.rates;
    } else {
      console.log("Currency Rates Serving from cache");
      currencyRates = exchangeRatesCache.rates;
    }
  } catch (err) {
    res.status(403).send("Something Went Wrong Fetch Base Currency");
  }
}
// @ts-ignore
function getDateRange(startDate, endDate) {
  startDate = moment(startDate);
  endDate = moment(endDate);

  let now = startDate,
    dates = [];

  while (now.isBefore(endDate) || now.isSame(endDate)) {
    dates.push(now.format("YYYY-MM-DD"));
    now.add(1, "days");
  }

  return dates;
}
async function convertPrice(amountToConvert: number, currency: string) {
  // @ts-ignore
  return await Math.floor(amountToConvert / currencyRates[currency].toFixed(2));
}
export { router as getHotelByID };
