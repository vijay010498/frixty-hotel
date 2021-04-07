import express, { Request, Response } from "express";
import { Booking } from "../../../models/Booking";
import { User } from "../../../models/User";

const keys = require("../../../config/keys");
const router = express.Router();

router.post("/api/stripe/user/webhook", async (req: Request, res: Response) => {
  const event = req.body;
  switch (event.type) {
    case "payment_intent.created":
      console.log("Payment Intent Created");
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  res.send({ received: true });
});

export { router as userStripeWebhookRouter };
