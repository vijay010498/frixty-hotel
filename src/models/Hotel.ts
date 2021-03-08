import mongoose from "mongoose";
import { addressObject } from "./objectModels/addressObject";
import { roomsObject } from "./objectModels/roomsObject";

//Booking.com features
import { titleAdditionalPayObject } from "./objectModels/titleAdditionalPayObject";
import { booleanObject } from "./objectModels/booleanObject";
import { booleanAndTitleObject } from "./objectModels/booleanAndTitleObject";

//Interface that describes the properties that are required to create a new Hotel
interface HotelAttrs {
  name: string;
  address: typeof addressObject;
  rooms: [typeof roomsObject];
  location: {};
  outdoors: [typeof titleAdditionalPayObject];
  pets: [typeof booleanObject];
  general: [typeof titleAdditionalPayObject];
  activities: [typeof titleAdditionalPayObject];
  frontDeskServices: [typeof titleAdditionalPayObject];
  foodAndDrink: [typeof titleAdditionalPayObject];
  entertainmentAndFamilyServices: [typeof titleAdditionalPayObject];
  cleaningServices: [typeof titleAdditionalPayObject];
  businessFacilities: [typeof titleAdditionalPayObject];
  safetyAndSecurity: [typeof titleAdditionalPayObject];
  spa: [typeof titleAdditionalPayObject];
  internet: [typeof booleanAndTitleObject];
  parking: [typeof booleanAndTitleObject];
  outdoorSwimmingPool: [typeof booleanAndTitleObject];
  languagesSpoken: [String];
  description: String;
  images: [String];
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
  outdoors: [typeof titleAdditionalPayObject];
  pets: [typeof booleanObject];
  general: [typeof titleAdditionalPayObject];
  activities: [typeof titleAdditionalPayObject];
  frontDeskServices: [typeof titleAdditionalPayObject];
  foodAndDrink: [typeof titleAdditionalPayObject];
  entertainmentAndFamilyServices: [typeof titleAdditionalPayObject];
  cleaningServices: [typeof titleAdditionalPayObject];
  businessFacilities: [typeof titleAdditionalPayObject];
  safetyAndSecurity: [typeof titleAdditionalPayObject];
  spa: [typeof titleAdditionalPayObject];
  internet: [typeof booleanAndTitleObject];
  parking: [typeof booleanAndTitleObject];
  outdoorSwimmingPool: [typeof booleanAndTitleObject];
  languagesSpoken: [String];
  description: String;
  images: [String];
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
    outdoors: [titleAdditionalPayObject],
    pets: booleanObject,
    general: [titleAdditionalPayObject],
    activities: [titleAdditionalPayObject],
    frontDeskServices: [titleAdditionalPayObject],
    foodAndDrink: [titleAdditionalPayObject],
    entertainmentAndFamilyServices: [titleAdditionalPayObject],
    cleaningServices: [titleAdditionalPayObject],
    businessFacilities: [titleAdditionalPayObject],
    safetyAndSecurity: [titleAdditionalPayObject],
    spa: [titleAdditionalPayObject],
    internet: [booleanAndTitleObject],
    parking: [booleanAndTitleObject],
    outdoorSwimmingPool: [booleanAndTitleObject],
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

const Hotel = mongoose.model<HotelDoc, HotelModel>("hotels", hotelSchema);

export { Hotel };
