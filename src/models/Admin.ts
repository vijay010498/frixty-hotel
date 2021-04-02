import mongoose from "mongoose";
import { Password } from "../services/auth/password";
import { addressObject } from "./objectModels/addressObject";

interface AdminAttrs {
  _id: mongoose.Types.ObjectId;
  hotelId: mongoose.Types.ObjectId;
  hotelName: string;
  hotelAddress: typeof addressObject;
  email: string;
  password: string;
  companyName: string;
  ownerName: string;
  contactNumber: string;
  whatsappNumber: string;
  emergencyContactNumber: string;
  ssmNumber: string;
  passportNumber: string;
  adminImageUrl: string;
  ssmCopyUrl: string;
  companyNameBoardImageUrl: string;
}
interface AdminModel extends mongoose.Model<AdminDoc> {
  build(attrs: AdminAttrs): AdminDoc;
}

interface AdminDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  hotelId: mongoose.Types.ObjectId;
  hotelName: string;
  hotelAddress: typeof addressObject;
  email: string;
  password: string;
  companyName: string;
  ownerName: string;
  contactNumber: string;
  whatsappNumber: string;
  emergencyContactNumber: string;
  ssmNumber: string;
  passportNumber: string;
  adminImageUrl: string;
  ssmCopyUrl: string;
  companyNameBoardImageUrl: string;
  blocked: boolean;
  stripeAccountId: string;
}

const adminSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    hotelAddress: addressObject,

    hotelName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    ownerName: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    whatsappNumber: {
      type: String,
      required: true,
    },
    emergencyContactNumber: {
      type: String,
    },
    ssmNumber: {
      type: String,
      required: true,
    },
    passportNumber: {
      type: String,
      required: true,
    },
    adminImageUrl: {
      type: String,
      required: true,
    },
    ssmCopyUrl: {
      type: String,
      required: true,
    },
    companyNameBoardImageUrl: {
      type: String,
      required: true,
    },
    stripeAccountId: {
      type: String,
      default: "default",
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
adminSchema.pre("save", async function (done) {
  if (this.isModified("password")) {
    const hashed = await Password.toHash(this.get("password"));
    this.set("password", hashed);
  }
  done();
});
adminSchema.pre("findOneAndUpdate", async function (next) {
  // @ts-ignore
  const password = this.getUpdate().$set.password;
  if (!password) {
    // @ts-ignore
    return next();
  }
  try {
    const hashed = await Password.toHash(password);
    this.set("password", hashed);
  } catch (error) {
    return next(error);
  }
});
adminSchema.statics.build = (attrs: AdminAttrs) => {
  return new Admin(attrs);
};
const Admin = mongoose.model<AdminDoc, AdminModel>("Admin", adminSchema);

export { Admin };
