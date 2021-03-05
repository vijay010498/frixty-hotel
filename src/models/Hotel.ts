import mongoose from "mongoose";

//Interface that describes the properties that are required to create a new Hotel
interface HotelAttrs {
  name: string;
  address: {};
  facility: [string];
  amenities: [string];
  rooms: [string];
  services: [string];
}

//An interface that describes the properties that a hotel model has
interface HotelModel extends mongoose.Model<HotelDoc> {
  build(attrs: HotelAttrs): HotelDoc;
}

//an interface that describes the properties that a hotel document has
interface HotelDoc extends mongoose.Document {
  name: string;
  address: {};
  facility: [string];
  amenities: [string];
  rooms: [string];
  services: [string];
}

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    address: {
      type: {},
      required: true,
    },
    facility: {
      type: [String],
      required: true,
    },
    amenities: {
      type: [String],
      required: true,
    },
    rooms: {
      type: [String],
      required: true,
    },
    services: {
      type: [String],
      required: true,
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  }
);

hotelSchema.statics.build = (attrs: HotelAttrs) => {
  return new Hotel(attrs);
};

const Hotel = mongoose.model<HotelDoc, HotelModel>("hotels", hotelSchema);

export { Hotel };
