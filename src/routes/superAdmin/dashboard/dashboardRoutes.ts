import express, { Request, Response } from "express";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
import { Admin } from "../../../models/Admin";
import { validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";
import { Booking } from "../../../models/Booking";
import axios from "axios";
import { ExchangeRatesCache } from "../../../models/Cache/ExchangeRatesCache";
const keys = require("../../../config/keys");
const router = express.Router({
  caseSensitive: true,
});

const today = new Date().toISOString().slice(0, 10);
const defaultBaseCurrency = "MYR";
let currencyRates = {};
let baseCurrency: string;
router.get(
  "/api/secure/sAdmin/dashboard",
  requireSuperAdmin,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      //get total admins
      const admins = await Admin.find();
      const totalAdmins = admins.length || 0;
      //total hotels
      const hotels = await Hotel.find();
      const totalHotels = hotels.length || 0;
      //total bookings
      const bookings = await Booking.find();
      const totalBookings = bookings.length || 0;
      //total confirmed bookings
      const confirmedBookings = await Booking.aggregate([
        {
          $match: {
            "bookingDetails.bookingStatus": { $eq: "confirmed" },
          },
        },
      ]);
      const totalConfirmedBookings = confirmedBookings.length || 0;
      //cancelled bookings
      const cancelledBookings = await Booking.aggregate([
        {
          $match: {
            "bookingDetails.bookingStatus": { $eq: "cancelled" },
          },
        },
      ]);
      const totalCancelledBookings = cancelledBookings.length || 0;

      //total checkins today
      const checkInToday = await Booking.aggregate([
        {
          $addFields: {
            stringCheckInDate: {
              $dateToString: {
                date: "$bookingDetails.checkInDateTime",
                format: "%Y-%m-%d",
              },
            },
          },
        },
        {
          $match: {
            $and: [
              { stringCheckInDate: { $eq: today } },
              { "bookingDetails.bookingStatus": { $eq: "confirmed" } },
            ],
          },
        },
      ]);
      const totalCheckInToday = checkInToday.length || 0;

      //total checkout today
      const checkOutToday = await Booking.aggregate([
        {
          $addFields: {
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
              { stringCheckOutDate: { $eq: today } },
              { "bookingDetails.bookingStatus": { $eq: "confirmed" } },
            ],
          },
        },
      ]);
      const totalCheckOutToday = checkOutToday.length || 0;

      //total booking amount in dashboard currency
      baseCurrency =
        req.query.baseCurrency ||
        req.cookies.dashboardBaseCurrency ||
        defaultBaseCurrency;
      await getCurrencyRates(res);
      //get All bookings
      const confirmedBookingsTotal = await Booking.aggregate([
        {
          $match: {
            "bookingDetails.bookingStatus": { $eq: "confirmed" },
          },
        },
      ]);
      let totalConfirmedBookingsAmount = 0;
      for (let i = 0; i < confirmedBookingsTotal.length; i++) {
        const paymentCurrency =
          confirmedBookingsTotal[i].bookingDetails.paymentDetails.details
            .paymentCurrency;
        const paymentAmount =
          confirmedBookingsTotal[i].bookingDetails.paymentDetails.details
            .totalPayment;
        const convertedAmount = parseFloat(
          Math.floor(
            // @ts-ignore
            paymentAmount / currencyRates[paymentCurrency]
          ).toFixed(2)
        );
        totalConfirmedBookingsAmount += convertedAmount;
      }
      res.cookie("dashboardBaseCurrency", baseCurrency);
      res.status(200).send({
        totalAdmins,
        totalHotels,
        totalBookings,
        totalConfirmedBookings,
        totalCancelledBookings,
        totalCheckInToday,
        totalCheckOutToday,
        totalConfirmedBookingsAmount,
      });
      return;
    } catch (err) {
      console.error(err);
      res.status(403).send(err);
      return;
    }
  }
);
async function getCurrencyRates(res: Response) {
  try {
    //check from mongo db first
    const exchangeRatesCache = await ExchangeRatesCache.findOne({
      base: baseCurrency,
    });
    if (!exchangeRatesCache) {
      //no cache
      console.log("Currency Rates Not Serving from cache");
      const response = await axios.get(
        "http://api.exchangeratesapi.io/latest",
        {
          params: {
            access_key: keys.exchangeRatesApi,
            base: baseCurrency,
          },
        }
      );
      const saveExchangeRatesCache = ExchangeRatesCache.build({
        base: baseCurrency,
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

export { router as superAdminDashboardRouter };
