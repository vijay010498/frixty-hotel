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
    case "payment_intent.processing":
      await paymentIntentProcessing(event);
      break;
    case "payment_intent.succeeded":
      await paymentIntentSucceeded(event);
      break;
    case "payment_intent.canceled":
      await paymentIntentCancelled(event);
      break;
    case "payment_intent.payment_failed":
      await paymentIntentFailed(event);
      break;
    case "charge.captured":
      await chargeCaptured(event);
      break;
    case "charge.expired":
      await chargeExpired(event);
      break;
    case "charge.failed":
      await chargeFailed(event);
      break;
    case "charge.pending":
      await chargePending(event);
      break;
    case "charge.refunded":
      await chargeRefunded(event);
      break;
    case "charge.succeeded":
      await chargeSucceeded(event);
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
    bookingStatus: "awaitingPayment",
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
  console.log("Webhook - User - Booking With Booking status Awaiting Payment ");
  return;
}
async function paymentIntentProcessing(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateBookingPaymentDetails(payment.id, payment, "processingPayment");
  console.log("Webhook - User - Booking With Booking status processingPayment");
  return;
}
async function paymentIntentSucceeded(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateBookingPaymentDetails(payment.id, payment, "confirmed");
  console.log("Webhook - User - Booking With Booking status confirmed ");
  return;
}
async function paymentIntentCancelled(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateBookingPaymentDetails(payment.id, payment, "paymentCancelled");
  console.log("Webhook - User - Booking With Booking status paymentCancelled ");
  return;
}
async function paymentIntentFailed(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateBookingPaymentDetails(payment.id, payment, "paymentFailed");
  console.log("Webhook - User - Booking With Booking status paymentFailed ");
  return;
}
async function chargeCaptured(event: Object) {
  // @ts-ignore
  const data = event.data.object;
  const paymentIntentId = data.payment_intent;
  const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
  await updateBookingPaymentDetails(paymentIntentId, payment, "confirmed");
  console.log(
    "Webhook  - User - Subscription With Charge Booking status Confirmed"
  );
  return;
}
async function chargeExpired(event: Object) {
  // @ts-ignore
  const data = event.data.object;
  const paymentIntentId = data.payment_intent;
  const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
  await updateBookingPaymentDetails(paymentIntentId, payment, "paymentFailed");
  console.log(
    "Webhook  - User - Subscription With Charge Booking status paymentFailed"
  );
  return;
}
async function chargeFailed(event: Object) {
  // @ts-ignore
  const data = event.data.object;
  const paymentIntentId = data.payment_intent;
  const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
  await updateBookingPaymentDetails(paymentIntentId, payment, "paymentFailed");
  console.log(
    "Webhook  - User - Subscription With Charge Booking status paymentFailed"
  );
  return;
}
async function chargePending(event: Object) {
  // @ts-ignore
  const data = event.data.object;
  const paymentIntentId = data.payment_intent;
  const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
  await updateBookingPaymentDetails(
    paymentIntentId,
    payment,
    "awaitingPayment"
  );
  console.log(
    "Webhook  - User - Subscription With Charge Booking status awaitingPayment"
  );
  return;
}
async function chargeRefunded(event: Object) {
  // @ts-ignore
  const data = event.data.object;
  const paymentIntentId = data.payment_intent;
  const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
  await updateBookingPaymentDetails(
    paymentIntentId,
    payment,
    "paymentRefunded"
  );
  console.log(
    "Webhook  - User - Subscription With Charge Booking status paymentRefunded"
  );
  return;
}
async function chargeSucceeded(event: Object) {
  // @ts-ignore
  const data = event.data.object;
  const paymentIntentId = data.payment_intent;
  const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
  await updateBookingPaymentDetails(paymentIntentId, payment, "confirmed");
  console.log(
    "Webhook  - User - Subscription With Charge Booking status confirmed"
  );
  return;
}
async function updateBookingPaymentDetails(
  paymentId: String,
  payment: Object,
  bookingStatus: String
) {
  const bookingArr = await Booking.aggregate([
    {
      $match: {
        "bookingDetails.paymentDetails.id": { $eq: paymentId },
      },
    },
  ]);
  const booking = bookingArr[0];
  //update booking payment status
  await Booking.findOneAndUpdate(
    {
      _id: booking._id,
    },
    {
      $set: {
        "bookingDetails.bookingStatus": bookingStatus,
        "bookingDetails.paymentDetails": payment,
      },
    }
  );
  return;
}

export { router as userStripeWebhookRouter };
