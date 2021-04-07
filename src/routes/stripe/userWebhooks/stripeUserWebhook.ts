import express, { Request, Response } from "express";
import { Booking } from "../../../models/Booking";

const keys = require("../../../config/keys");
const stripe = require("stripe")(keys.stripeUserSecretKey);
const router = express.Router();

router.post("/api/stripe/user/webhook", async (req: Request, res: Response) => {
  const event = req.body;
  switch (event.type) {
    case "payment_intent.created":
      await paymentIntentCreated(event);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  res.send({ received: true });
});
async function paymentIntentCreated(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  const {
    hotelId,
    roomId,
    roomConfig,
    checkIn,
    checkOut,
    totalDays,
    totalGuests,
    totalAmount,
    currency,
    rooms,
    userId,
  } = payment.metadata;
  const roomConfigArr = roomConfig.split("_");
  const totalRoomsData = roomConfigArr[0];
  const totalRooms = totalRoomsData[0];
  const guestsPerRoom = totalRoomsData[2];
  const bookingDetails = {
    bookingStatus: "AwaitingPayment",
    totalGuests: totalGuests,
    totalDays: totalDays,
    roomConfiguration: {
      totalRooms: totalRooms,
      totalGuestsPerRoom: guestsPerRoom,
    },
    checkInDateTime: new Date(checkIn),
    checkOutDateTime: new Date(checkOut),
    paymentDetails: payment,
  };

  const booking = Booking.build({
    // @ts-ignore
    bookingDetails: bookingDetails,
    hotelId: hotelId,
    roomId: roomId,
    userId: userId,
  });
  await booking.save();
  console.log("Webhook - User - Booking With Awaiting Payment ");
  return;
}

export { router as userStripeWebhookRouter };
