import express, { Request, Response } from "express";

const router = express.Router({
  caseSensitive: true,
});
router.post("/stripe/webhook", async (req: Request, res: Response) => {
  const event = req.body;

  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log(paymentIntent);
      console.log("Payment Intent was successful");
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  res.send({ received: true });
});

export { router as stripeWebhookRouter };
