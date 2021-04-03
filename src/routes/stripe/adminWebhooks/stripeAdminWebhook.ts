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
      await paymentIntentPaymentFailed(event);
      break;
    case "payment_intent.requires_action":
      await paymentIntentRequiresAction(event);
      break;
    case "payment_intent.amount_capturable_updated":
      await paymentIntentAmountCapturableUpdated(event);
      break;
    case "charge.refunded":
      const data = event.data.object;
      const paymentIntentId = data.payment_intent;
      const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log(payment);
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
  await updateSubscriptionPaymentDetails(payment.id, payment);
  console.log("Webhook  - Admin - Subscription With Payment Succeeded");
  return;
}

async function paymentIntentCancelled(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateSubscriptionPaymentDetails(payment.id, payment);
  console.log("Webhook  - Admin - Subscription With Payment Succeeded");
  return;
}
async function paymentIntentPaymentFailed(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateSubscriptionPaymentDetails(payment.id, payment);
  console.log("Webhook  - Admin - Subscription With Payment Failed");
  return;
}
async function paymentIntentProcessing(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateSubscriptionPaymentDetails(payment.id, payment);
  console.log("Webhook  - Admin - Subscription With Payment Processing");
  return;
}

async function paymentIntentRequiresAction(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateSubscriptionPaymentDetails(payment.id, payment);
  console.log("Webhook  - Admin - Subscription With Payment Requires Action");
  return;
}

async function paymentIntentAmountCapturableUpdated(event: Object) {
  // @ts-ignore
  const paymentIntent = event.data.object;
  const payment = await stripe.paymentIntents.retrieve(paymentIntent.id);
  await updateSubscriptionPaymentDetails(payment.id, payment);
  console.log(
    "Webhook  - Admin - Subscription With Payment amount  Capturable Updated"
  );
  return;
}

async function updateSubscriptionPaymentDetails(
  paymentId: String,
  payment: Object
) {
  // @ts-ignore
  const adminSubscriptionArr = await AdminSubscription.aggregate([
    {
      $match: {
        // @ts-ignore
        "paymentDetails.id": { $eq: paymentId },
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
