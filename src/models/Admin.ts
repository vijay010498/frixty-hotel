import mongoose from "mongoose";
import { Password } from "../services/auth/password";
import { addressObject } from "./objectModels/addressObject";

interface AdminAttrs {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  imageUrl: string;
  document: string;
  hotelId: mongoose.Types.ObjectId;
  hotelName: string;
  hotelAddress: typeof addressObject;
}
interface AdminModel extends mongoose.Model<AdminDoc> {
  build(attrs: AdminAttrs): AdminDoc;
}

interface AdminDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  imageUrl: string;
  document: string;
  hotelId: mongoose.Types.ObjectId;
  hotelName: string;
  hotelAddress: typeof addressObject;
}

const adminSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Types.ObjectId,
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
    fullName: {
      type: String,
      required: true,
    },
    hotelAddress: addressObject,
    phoneNumber: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    imageUrl: String,
    document: String,
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    hotelName: {
      type: String,
      required: true,
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
