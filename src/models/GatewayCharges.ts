import mongoose from "mongoose";

interface GatewayChargesAttrs {
  percentage: number;
}

interface GatewayChargesModel extends mongoose.Model<GatewayChargesDoc> {
  build(attrs: GatewayChargesAttrs): GatewayChargesDoc;
}

interface GatewayChargesDoc extends mongoose.Document {
  percentage: number;
}

const GatewayChargesSchema = new mongoose.Schema(
  {
    percentage: {
      type: Number,
      required: true,
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

GatewayChargesSchema.statics.build = (attrs: GatewayChargesAttrs) => {
  return new GatewayCharge(attrs);
};
const GatewayCharge = mongoose.model<GatewayChargesDoc, GatewayChargesModel>(
  "GatewayCharges",
  GatewayChargesSchema
);
export { GatewayCharge };
