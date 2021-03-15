import mongoose from "mongoose";
import { addressObject } from "./objectModels/addressObject";
import { roomsObject } from "./objectModels/roomsObject";

import { titleObject } from "./objectModels/titleObject";

//Booking.com features
import { titleAdditionalPayObject } from "./objectModels/titleAdditionalPayObject";
import { booleanObject } from "./objectModels/booleanObject";
import { booleanAndTitleObject } from "./objectModels/booleanAndTitleObject";
import { SupportedCurrencies } from "./enums/supportedCurrencies";

//Interface that describes the properties that are required to create a new Hotel
interface HotelAttrs {
  name: string;
  address: typeof addressObject;
  rooms: [typeof roomsObject];
  location: {};
  languagesSpoken: [string];
  description: string;
  images: [string];
  amenities: [typeof titleObject];
  homeCurrency: SupportedCurrencies;
}

//An interface that describes the properties that a hotel model has
interface HotelModel extends mongoose.Model<HotelDoc> {
  build(attrs: HotelAttrs): HotelDoc;
}

//an interface that describes the properties that a hotel document has
interface HotelDoc extends mongoose.Document {
  name: string;
  address: typeof addressObject;
  rooms: [typeof roomsObject];
  location: {};
  languagesSpoken: [string];
  description: string;
  images: [string];
  amenities: [typeof titleObject];
  homeCurrency: SupportedCurrencies;
}

const hotelSchema = new mongoose.Schema(
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
    },
    address: addressObject,
    rooms: [roomsObject],
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    homeCurrency: {
      type: String,
      required: true,
      enum: Object.values(SupportedCurrencies),
    },
    amenities: [titleObject],
    languagesSpoken: {
      type: [
        {
          type: String,
          uppercase: true,
        },
      ],
      required: true,
    },
    images: {
      type: [String],
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
hotelSchema.index({ location: "2dsphere" });
hotelSchema.statics.build = (attrs: HotelAttrs) => {
  return new Hotel(attrs);
};

const Hotel = mongoose.model<HotelDoc, HotelModel>("Hotel", hotelSchema);

export { Hotel };
