import mongoose from "mongoose";
import { OTPService } from "../services/auth/OTPService";
interface OTPAttrs {
  email: string;
  OTP: Number;
}

interface OTPModel extends mongoose.Model<OTPDoc> {
  build(attrs: OTPAttrs): OTPDoc;
}
interface OTPDoc extends mongoose.Document {
  email: string;
  createdAt: Date;
}
const OTPSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    OTP: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // 5 mins
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.email;
      },
    },
  }
);

OTPSchema.pre("save", async function (done) {
  if (this.isModified("OTP")) {
    const hashed = await OTPService.toHash(this.get("OTP"));
    this.set("OTP", hashed);
  }
  done();
});
OTPSchema.statics.build = (attrs: OTPAttrs) => {
  return new OTP(attrs);
};
const OTP = mongoose.model<OTPDoc, OTPModel>("OTPS", OTPSchema);
export { OTP };
