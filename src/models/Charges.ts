import mongoose from "mongoose";

interface ChargesAttrs {
  percentage: number;
  name: string;
  isApplicable: boolean;
}

interface ChargesModel extends mongoose.Model<ChargesDoc> {
  build(attrs: ChargesAttrs): ChargesDoc;
}

interface ChargesDoc extends mongoose.Document {
  percentage: number;
  name: string;
  isApplicable: boolean;
}

const ChargesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      uppercase: true,
    },
    isApplicable: {
      type: Boolean,
      default: true,
      required: true,
      index: true,
    },
    percentage: {
      type: Number,
      required: true,
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

ChargesSchema.statics.build = (attrs: ChargesAttrs) => {
  return new Charges(attrs);
};
const Charges = mongoose.model<ChargesDoc, ChargesModel>(
  "Charges",
  ChargesSchema
);
export { Charges };
