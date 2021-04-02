import express, { Request, Response } from "express";
import { BadRequestError, validateRequest } from "../../../errors";
import { requireAdmin } from "../../../errors/middleware/admin/require-admin";
import { Subscription } from "../../../models/Subscription";
import { body } from "express-validator";
import { ExchangeRatesCache } from "../../../models/Cache/ExchangeRatesCache";
import axios from "axios";
import jwt from "jsonwebtoken";
import { Admin } from "../../../models/Admin";
const keys = require("../../../config/keys");
const stripe = require("stripe")(keys.stripeSecretKey);
let currencyRates = {};
let requestedCurrency: string;
const router = express.Router({
  caseSensitive: true,
});
const DEFAULT_CURRENCY = "MYR";

router.get(
  "/api/secure/v1/admin/checkSubscription",
  requireAdmin,
  [],
  validateRequest,
  async (req: Request, res: Response) => {}
);

router.get(
  "/api/secure/v1/admin/subscriptions",
  requireAdmin,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const subscriptions = await Subscription.find();
      res.status(200).send(subscriptions);
      return;
    } catch (err) {
      console.error(err);
      res.status(401).send(err);
      return;
    }
  }
);
router.post(
  "/api/secure/v1/admin/create-subscription-checkout",
  requireAdmin,
  [
    body("subscriptionId")
      .isMongoId()
      .withMessage("Subscription Id Is Required"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { subscriptionId } = req.body;
    // @ts-ignore
    requestedCurrency = req.body.requestedCurrency || DEFAULT_CURRENCY;
    await getCurrencyRates(res);
    //first get subscription details
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new BadRequestError("Subscription Does Not Exists");
    }
    const payload = await jwt.verify(req.session!.JWT, keys.jwtAdminKey);
    // @ts-ignore
    const admin = await Admin.findById(payload.userId);

    try {
      const customer = await stripe.customers.retrieve(admin!.stripeAccountId);
    } catch (err) {
      if (err.raw.statusCode === 404) {
        //no customer create new one
        const customer = await stripe.customers.create({
          email: admin!.email,
          name: admin!.ownerName,
          phone: admin!.whatsappNumber,
          address: {
            city: admin!.hotelAddress.city,
            country: admin!.hotelAddress.country,
            postal_code: admin!.hotelAddress.pinCode,
            state: admin!.hotelAddress.state,
            line1: admin!.hotelAddress.street,
          },
          description: "A Chill-in admin",
          metadata: {
            chillInAdminId: admin!.id,
          },
        });
        //update customer id
        admin!.stripeAccountId = customer.id;
        await Admin.findOneAndUpdate(
          {
            _id: admin!.id,
          },
          {
            $set: {
              stripeAccountId: customer.id,
            },
          }
        );
      }
    }

    //create stripe session
    const session = await stripe.checkout.sessions.create({
      cancel_url: "http://localhost:3001/admin",
      success_url: "http://localhost:3001/admin",
      mode: "payment",
      payment_method_types: ["card"],
      // @ts-ignore
      client_reference_id: payload.userId,
      customer: admin!.stripeAccountId,
      payment_intent_data: {
        metadata: {
          subscriptionId: subscriptionId,
          adminId: admin!.id,
        },
        receipt_email: admin!.email,
      },
      line_items: [
        {
          price_data: {
            currency: requestedCurrency,
            product_data: {
              name: `Chill In ${subscription.name} Subscription`,
              description: `${subscription.totalRoomsPermitted} Rooms \n ${subscription.totalHotelImagesPermitted} Hotel Images \n ${subscription.totalRoomImagesPermitted} Images Per Room \n ${subscription.validityInDays} Days Validity \n`,
            },
            unit_amount: await convertPrice(
              subscription.amount,
              subscription.currency
            ),
          },
          quantity: 1,
        },
      ],
    });
    res.send({ id: session.id });
    return;
  }
);
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
async function convertPrice(amountToConvert: number, currency: string) {
  if (
    requestedCurrency === "BIF" ||
    requestedCurrency === "CLP" ||
    requestedCurrency === "DJF" ||
    requestedCurrency === "GNF" ||
    requestedCurrency === "JPY" ||
    requestedCurrency === "KMF" ||
    requestedCurrency === "KRW" ||
    requestedCurrency === "MGA" ||
    requestedCurrency === "PYG" ||
    requestedCurrency === "RWF" ||
    requestedCurrency === "UGX" ||
    requestedCurrency === "VND" ||
    requestedCurrency === "VUV" ||
    requestedCurrency === "XAF" ||
    requestedCurrency === "XOF" ||
    requestedCurrency === "XPF"
  )
    return (
      // @ts-ignore
      Math.floor(amountToConvert / currencyRates[currency].toFixed(2))
    );
  else {
    return (
      // @ts-ignore
      Math.floor(amountToConvert / currencyRates[currency].toFixed(2)) * 100
    );
  }
}
export { router as adminSubscriptionCharge };
