import express, { Request, Response } from "express";
import { Subscription } from "../../../models/Subscription";
import { AdminSubscription } from "../../../models/AdminSubscriptions";

const keys = require("../../../config/keys");
const stripe = require("stripe")(keys.stripeSecretKey);
const router = express.Router({
  caseSensitive: true,
});
router.post("/stripe/admin/webhook", async (req: Request, res: Response) => {
  const event = req.body;

  switch (event.type) {
    case "payment_intent.created":
      await paymentIntentCreated(event);
      break;
    case "charge.refunded":
      const data = event.data.object;
      const paymentIntentId = data.payment_intent;
      const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log(payment);
      break;
    case "payment_intent.succeeded":
      await paymentIntentSucceeded(event);
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
  const subscriptionId = payment.metadata.subscriptionId;
  //get subscription first
  const subscription = await Subscription.findById(subscriptionId);
  const subscriptionValidity = subscription!.validityInDays;
  let expiry = new Date();
  expiry.setDate(expiry.getDate() + subscriptionValidity);
  const adminSubscription = AdminSubscription.build({
    adminId: payment.metadata.adminId,
    expiryString: expiry.toISOString().slice(0, 10),
    paymentDetails: payment,
    subscriptionId: subscriptionId,
    expiry: expiry,
  });
  await adminSubscription.save();
  console.log("Webhook  - Admin - Subscription With Payment Created");
  return;
}

async function paymentIntentSucceeded(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  //get the already payment from db
  const adminSubscriptionArr = await AdminSubscription.aggregate([
    {
      $match: {
        "paymentDetails.id": { $eq: payment.id },
      },
    },
  ]);
  const adminSubscription = adminSubscriptionArr[0];
  //update payment details
  await AdminSubscription.findOneAndUpdate(
    {
      _id: adminSubscription._id,
    },
    {
      $set: {
        paymentDetails: payment,
      },
    }
  );
  return;
}

export { router as stripeAdminWebhookRouter };
