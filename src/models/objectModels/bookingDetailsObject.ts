import { BookingStatus } from "../enums/booking-status";
import mongoose from "mongoose";

const bookingDetailsObject = {
  bookingStatus: {
    type: String,
    required: true,
    enum: Object.values(BookingStatus),
    index: true,
  },
  totalPeopleStaying: {
    type: Number,
    required: true,
  },
  checkInDateTime: {
    type: mongoose.Schema.Types.Date, // UTC by default
    required: true,
    index: true,
  },
  checkOutDateTime: {
    type: mongoose.Schema.Types.Date, // UTC by default
    required: true,
    index: true,
  },
  paymentDetails: {
    isOnlinePayment: {
      type: Boolean,
      required: true,
    },
    details: {
      paymentMode: {
        type: String,
        required: true,
      },
      totalPayment: {
        type: Number,
        required: true,
      },
    },
  },
};

export { bookingDetailsObject };
