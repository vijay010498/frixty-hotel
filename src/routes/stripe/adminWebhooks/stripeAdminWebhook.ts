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
    case "charge.refunded":
      const data = event.data.object;
      const paymentIntentId = data.payment_intent;
      const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log(payment);
      break;
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      if (paymentIntent.status === "succeeded") {
        //payment success
        //get payment intent details
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
        console.log("Webhook  - Admin - Subscription successful");
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  res.send({ received: true });
});

export { router as stripeAdminWebhookRouter };
