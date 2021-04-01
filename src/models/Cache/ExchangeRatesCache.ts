import mongoose from "mongoose";

interface ExchangeRatesCacheAttrs {
  rates: {};
  base: string;
}

interface ExchangeRatesCacheModel
  extends mongoose.Model<ExchangeRatesCacheDoc> {
  build(attrs: ExchangeRatesCacheAttrs): ExchangeRatesCacheDoc;
}

interface ExchangeRatesCacheDoc extends mongoose.Document {
  rates: {};
  base: string;
}

const ExchangeRatesCacheSchema = new mongoose.Schema(
  {
    rates: {
      type: Object,
      required: true,
    },
    base: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 43200, // 12 hrs
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);
ExchangeRatesCacheSchema.statics.build = (attrs: ExchangeRatesCacheAttrs) => {
  return new ExchangeRatesCache(attrs);
};

const ExchangeRatesCache = mongoose.model<
  ExchangeRatesCacheDoc,
  ExchangeRatesCacheModel
>("ExchangeRatesCache", ExchangeRatesCacheSchema);
export { ExchangeRatesCache };
