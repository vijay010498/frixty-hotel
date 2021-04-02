import mongoose from "mongoose";
import { SupportedCurrencies } from "./enums/supportedCurrencies";

interface AdminSubscriptionsAttrs {
  adminId: mongoose.Schema.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  expiry: string;
}

interface AdminSubscriptionsModel
  extends mongoose.Model<AdminSubscriptionsDoc> {
  build(attrs: AdminSubscriptionsAttrs): AdminSubscriptionsDoc;
}
interface AdminSubscriptionsDoc extends mongoose.Document {
  adminId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  expiry: string;
}

const adminSubscriptionSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    expiry: {
      type: String,
      required: true,
      index: true,
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

adminSubscriptionSchema.statics.build = (attrs: AdminSubscriptionsAttrs) => {
  return new AdminSubscription(attrs);
};
const AdminSubscription = mongoose.model<
  AdminSubscriptionsDoc,
  AdminSubscriptionsModel
>("AdminSubscription", adminSubscriptionSchema);

export { AdminSubscription };
