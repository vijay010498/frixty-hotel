import express, { Request, Response } from "express";
import { requireUserAuth } from "../../../errors/middleware/users/require-user-auth";
import { BadRequestError, validateRequest } from "../../../errors";
import jwt from "jsonwebtoken";
import { User } from "../../../models/User";
import mongoose from "mongoose";
import { body, query } from "express-validator";
import { Hotel } from "../../../models/Hotel";
import { Booking } from "../../../models/Booking";
const router = express.Router();
const keys = require("../../../config/keys");
const stripe = require("stripe")(keys.stripeUserSecretKey);
router.post(
  "/api/v1/booking/newBooking",
  requireUserAuth,
  [
    body("hotelId").isMongoId().withMessage("Hotel Id Required"),
    body("roomId").isMongoId().withMessage("Room Id Required"),
    body("roomConfig").isString().withMessage("Room Config Is Required"),
    body("checkIn").isString().withMessage("Check In Is Required"),
    body("checkOut").isString().withMessage("Check Out Is Required"),
    body("totalDays").isNumeric().withMessage("Total Days Is Required"),
    body("totalGuests").isNumeric().withMessage("Total Guests Is Required"),
    body("totalAmount").isNumeric().withMessage("Total Amount Is Required"),
    body("currency").isString().withMessage("Currency Is Required"),
    body("rooms").isNumeric().withMessage("Rooms Is Required"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    // @ts-ignore
    const payload = await jwt.verify(req.body.jwtAuthToken, keys.jwtKey);
    // @ts-ignore
    const user = await User.findById(payload.userId);

    const hotel = await Hotel.findById(req.body.hotelId);

    try {
      const customer = await stripe.customers.retrieve(user!.stripeAccountId);
    } catch (err) {
      if (err.raw.statusCode === 404) {
        //no stripe customer create new one
        const customer = await stripe.customers.create({
          email: user!.email,
          name: user!.fullName,
          phone: user!.phoneNumber,
          description: "A Chill-in User",
          metadata: {
            chillInUserId: user!.id,
          },
        });
        //update stripe customer id
        user!.stripeAccountId = customer.id;
        await User.findOneAndUpdate(
          {
            _id: mongoose.Types.ObjectId(user!.id),
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
      cancel_url: "https://chillin/cancel",
      success_url: "https://chillin/success",
      mode: "payment",
      payment_method_types: ["card"],

      client_reference_id: user!.id,
      customer: user!.stripeAccountId,
      payment_intent_data: {
        metadata: {
          hotelId: req.body.hotelId,
          roomId: req.body.roomId,
          roomConfig: req.body.roomConfig,
          checkIn: req.body.checkIn,
          checkOut: req.body.checkOut,
          totalDays: req.body.totalDays,
          totalGuests: req.body.totalGuests,
          totalAmount: req.body.totalAmount,
          currency: req.body.currency,
          userId: user!.id,
          rooms: req.body.rooms,
        },
      },
      line_items: [
        {
          price_data: {
            currency: req.body.currency,
            product_data: {
              name: `Chill In booking from ${req.body.checkIn} to ${
                req.body.checkOut
              } at ${hotel!.name}`,
              description: `${hotel!.address.street},${hotel!.address.city},${
                hotel!.address.area
              },${hotel!.address.state},${hotel!.address.country},${
                hotel!.address.pinCode
              }.`,
              images: [hotel!.images[0]],
            },
            unit_amount: await convertStripeAmount(
              req.body.totalAmount,
              req.body.currency
            ),
          },
          quantity: 1,
        },
      ],
    });
    res.send({ id: session.id });
    return;
    //create stripe
    /* const paymentIntent = await stripe.paymentIntents.create({
      currency: req.body.currency,
      amount: await convertStripeAmount(
        req.body.totalAmount,
        req.body.currency
      ),
      customer: user!.stripeAccountId,
      description: "A booking ",
      payment_method_types: ["card"],
      metadata: {
        hotelId: req.body.hotelId,
        roomId: req.body.roomId,
        roomConfig: req.body.roomConfig,
        checkIn: req.body.checkIn,
        checkOut: req.body.checkOut,
        totalDays: req.body.totalDays,
        totalGuests: req.body.totalGuests,
        totalAmount: req.body.totalAmount,
        currency: req.body.currency,
        userId: user!.id,
        rooms: req.body.rooms,
      },
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    });*/
  }
);
async function convertStripeAmount(amountToConvert: number, currency: string) {
  if (
    currency === "BIF" ||
    currency === "CLP" ||
    currency === "DJF" ||
    currency === "GNF" ||
    currency === "JPY" ||
    currency === "KMF" ||
    currency === "KRW" ||
    currency === "MGA" ||
    currency === "PYG" ||
    currency === "RWF" ||
    currency === "UGX" ||
    currency === "VND" ||
    currency === "VUV" ||
    currency === "XAF" ||
    currency === "XOF" ||
    currency === "XPF"
  ) {
    return amountToConvert;
  } else {
    return amountToConvert * 100;
  }
}

//get user bookings
router.post(
  "/api/v1/bookings/getUserBookings",
  requireUserAuth,
  [
    body("jwtAuthToken")
      .isString()
      .withMessage("Please include user jwt auth token"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const payload = await jwt.verify(req.body.jwtAuthToken, keys.jwtKey);
    // @ts-ignore
    const user = await User.findById(payload.userId);
    //get user bookings
    const bookings = await Booking.find({
      userId: user!.id,
    }).sort({
      createdAt: -1,
    });
    if (bookings.length === 0) {
      throw new BadRequestError("No Bookings Found");
    }
    res.status(200).send({
      bookings,
    });
    return;
  }
);

export { router as userChargeAndBookingRouter };
