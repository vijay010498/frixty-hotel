import mongoose from "mongoose";
import { addressObject } from "./objectModels/addressObject";
import { facilityObject } from "./objectModels/facilityObject";
import { amenitiesObject } from "./objectModels/amenitiesObject";
import { roomsObject } from "./objectModels/roomsObject";
import { serviceObject } from "./objectModels/serviceObject";

//Interface that describes the properties that are required to create a new Hotel
interface HotelAttrs {
  name: string;
  address: typeof addressObject;
  facility: [typeof facilityObject];
  amenities: [typeof amenitiesObject];
  rooms: [typeof roomsObject];
  services: [typeof serviceObject];
  location: {};
}

//An interface that describes the properties that a hotel model has
interface HotelModel extends mongoose.Model<HotelDoc> {
  build(attrs: HotelAttrs): HotelDoc;
}

//an interface that describes the properties that a hotel document has
interface HotelDoc extends mongoose.Document {
  name: string;
  address: typeof addressObject;
  facility: [typeof facilityObject];
  amenities: [typeof amenitiesObject];
  rooms: [typeof roomsObject];
  services: [typeof serviceObject];
  location: {};
}

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
    },
    address: addressObject,
    facility: [facilityObject],
    amenities: [amenitiesObject],
    rooms: [roomsObject],
    services: [serviceObject],
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
hotelSchema.index({ location: "2dsphere" });
hotelSchema.statics.build = (attrs: HotelAttrs) => {
  return new Hotel(attrs);
};

const Hotel = mongoose.model<HotelDoc, HotelModel>("hotels", hotelSchema);

export { Hotel };
