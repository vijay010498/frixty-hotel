import mongoose from "mongoose";
import { SupportedCurrencies } from "./enums/supportedCurrencies";

interface SubscriptionAttrs {
  name: string;
  image: string;
  description: string;
  currency: SupportedCurrencies;
  amount: number;
  validityInDays: number;
  totalRoomsPermitted: number;
  totalHotelImagesPermitted: number;
  totalRoomImagesPermitted: number;
}

interface SubscriptionModel extends mongoose.Model<SubscriptionDoc> {
  build(attrs: SubscriptionAttrs): SubscriptionDoc;
}

interface SubscriptionDoc extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  currency: SupportedCurrencies;
  amount: number;
  validityInDays: number;
  totalRoomsPermitted: number;
  totalHotelImagesPermitted: number;
  totalRoomImagesPermitted: number;
}

const subscriptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
      uppercase: true,
    },
    image: String,
    currency: {
      type: String,
      required: true,
      enum: Object.values(SupportedCurrencies),
      default: "MYR",
    },
    amount: {
      type: Number,
      required: true,
    },
    validityInDays: {
      type: Number,
      required: true,
    },
    totalRoomsPermitted: {
      type: Number,
      required: true,
      default: 5,
    },
    totalHotelImagesPermitted: {
      type: Number,
      required: true,
      default: 5,
    },
    totalRoomImagesPermitted: {
      type: Number,
      required: true,
      default: 5,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        const createdAtISO = ret.createdAt;
        delete ret.createdAt;
        ret.createdAt = createdAtISO.getTime();
        const updatedAtISO = ret.updatedAt;
        delete ret.updatedAt;
        ret.updatedAt = updatedAtISO.getTime();
      },
    },
  }
);
subscriptionSchema.statics.build = (attrs: SubscriptionAttrs) => {
  return new Subscription(attrs);
};

const Subscription = mongoose.model<SubscriptionDoc, SubscriptionModel>(
  "Subscription",
  subscriptionSchema
);
export { Subscription };
