import express, { Request, Response } from "express";
import { body, param } from "express-validator";

import { BadRequestError, NotFoundError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";
import { exchangeRates } from "exchange-rates-api";
import { SupportedCurrencies } from "../../models/enums/supportedCurrencies";
import { GatewayCharge } from "../../models/GatewayCharges";
import { Booking } from "../../models/Booking";
import { checkHotelExists } from "../../errors/middleware/hotel-exists";
import mongoose from "mongoose";

const router = express.Router();
const defaultCurrency = "MYR";
const defaultTotalGuests = 1;
const defaultSortOrder = 1;
let gatewayChargesForHotelPercentage: number;
let currencyRates = {};
let requestedCurrency: string;
let checkIn: string;
let checkOut: string;
let totalDays: number;
let totalGuests: number;
let roomId: string;

router.get(
  "/api/v1/hotel/:hotelId",
  checkHotelExists,
  [param("hotelId").isMongoId().withMessage("Id Must Be String")],
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

    //To Calculate total days
    const checkInStr = new Date(checkIn);
    const checkOutStr = new Date(checkOut);
    totalDays =
      (checkOutStr.getTime() - checkInStr.getTime()) / (1000 * 60 * 60 * 24);
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
    totalGuests = parseInt(req.query.totalGuests) || defaultTotalGuests;

    //first get hotel to get room Id for matching total guest

    const hotels = await Hotel.aggregate([
      {
        $match: {
          // @ts-ignore
          _id: mongoose.Types.ObjectId(req.params.hotelId),
          isServiceable: true,
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
          isServiceable: true,
        },
      },
      {
        $sort: {
          "rooms.priceForOneNight": defaultSortOrder,
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
    if (hotels.length === 0) {
      throw new BadRequestError("Given request is not valid with this hotel");
    }
    if (hotels && hotels[0].rooms) {
      roomId = hotels[0].rooms[0].id;
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
  });
}
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
              hotels[i].rooms.splice(j, 1);
            }
          }
        }
      }
    }

    //update total rooms available after all checking
    for (let i = 0; i < hotels.length; i++) {
      hotels[i].totalRoomAvailable = hotels[i].rooms.length;
    }
  } catch (err) {
    console.error(err);
    return;
  }
};

const transformObject = async (hotels: Array<any>) => {
  for (let i = 0; i < hotels.length; i++) {
    if (hotels[i].rooms) {
      for (let j = 0; j < hotels[i].rooms.length; j++) {
        hotels[i].rooms[j].id = hotels[i].rooms[j]._id;
        delete hotels[i].rooms[j]._id;

        //add gateway charges to hotel room price
        hotels[i].rooms[j].priceForOneNight += await Math.ceil(
          (gatewayChargesForHotelPercentage / 100) *
            hotels[i].rooms[j].priceForOneNight
        );

        //add discount logic
        if (hotels[i].rooms[j].discount.isDiscount) {
          //Yes There is some discount
          hotels[i].rooms[j].priceForOneNight -= await Math.ceil(
            (hotels[i].rooms[j].discount.discountPercentage / 100) *
              hotels[i].rooms[j].priceForOneNight
          );
        }

        //price conversion
        hotels[i].rooms[j].priceForOneNight = await Math.floor(
          hotels[i].rooms[j].priceForOneNight / // @ts-ignore
            currencyRates[hotels[i].homeCurrency].toFixed(2)
        );

        //Multiply priceForOneNight with totalDays
        hotels[i].rooms[j].price =
          hotels[i].rooms[j].priceForOneNight * totalDays;

        //added discounted amount if
        if (hotels[i].rooms[j].discount.isDiscount) {
          hotels[i].rooms[j].discount.totalDiscountAmount = await Math.ceil(
            (hotels[i].rooms[j].discount.discountPercentage / 100) *
              hotels[i].rooms[j].price
          );
        } else {
          hotels[i].rooms[j].discount.totalDiscountAmount = 0;
        }
      }
    }
    //No rooms in that hotel so remove the hotel from array
    if (hotels[i].rooms.length === 0) {
      hotels.splice(i, 1);
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
    res.status(403).send("Something Went Wrong");
  }
}

export { router as getHotelByID };
