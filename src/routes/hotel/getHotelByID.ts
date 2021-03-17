import express, { Request, Response } from "express";
import { body, param } from "express-validator";

import { BadRequestError, NotFoundError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";
import { exchangeRates } from "exchange-rates-api";
import { SupportedCurrencies } from "../../models/enums/supportedCurrencies";
import { GatewayCharge } from "../../models/GatewayCharges";
import { Booking } from "../../models/Booking";

const router = express.Router();
const defaultCurrency = "MYR";
const defaultTotalGuests = 1;
let gatewayChargesForHotelPercentage: number;
let currencyRates = {};
let requestedCurrency: string;
let checkIn: string;
let checkOut: string;
let totalDays: number;
router.get(
  "/api/v1/hotel/:id",
  [param("id").isString().withMessage("Id Must Be String")],
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
    const totalGuests = parseInt(req.query.totalGuests) || defaultTotalGuests;
  }
);

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
