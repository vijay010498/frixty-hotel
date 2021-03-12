import mongoose from "mongoose";
import { Password } from "../services/auth/password";

interface SuperAdminAttrs {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
}

interface SuperAdminModel extends mongoose.Model<SuperAdminDoc> {
  build(attrs: SuperAdminAttrs): SuperAdminDoc;
}

interface SuperAdminDoc extends mongoose.Document {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
}

const SuperAdminSchema = new mongoose.Schema(
  {
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
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
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

SuperAdminSchema.pre("save", async function (done) {
  if (this.isModified("password")) {
    const hashed = await Password.toHash(this.get("password"));
    this.set("password", hashed);
  }
  done();
});
SuperAdminSchema.pre("findOneAndUpdate", async function (next) {
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

SuperAdminSchema.statics.build = (attrs: SuperAdminAttrs) => {
  return new SuperAdmin(attrs);
};

const SuperAdmin = mongoose.model<SuperAdminDoc, SuperAdminModel>(
  "Superadmin",
  SuperAdminSchema
);

export { SuperAdmin };
