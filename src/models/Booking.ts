import mongoose from "mongoose";
import { bookingDetailsObject } from "./objectModels/bookingDetailsObject";

//Interface that describes the properties that are required to create a new Booking
interface BookingAttrs {
  userId: string;
  hotelId: string;
  roomId: string;
  bookingDetails: typeof bookingDetailsObject;
}

//Interface that describes  the properties that a booking model has

interface BookingModel extends mongoose.Model<BookingDoc> {
  build(attrs: BookingAttrs): BookingDoc;
}

//an interface that describes the properties that a hotel document has
interface BookingDoc extends mongoose.Document {
  userId: string;
  hotelId: string;
  roomId: string;
  bookingDetails: typeof bookingDetailsObject;
}
const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    bookingDetails: bookingDetailsObject,
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

bookingSchema.statics.build = (attrs: BookingAttrs) => {
  return new Booking(attrs);
};

const Booking = mongoose.model<BookingDoc, BookingModel>(
  "Booking",
  bookingSchema
);
export { Booking };
