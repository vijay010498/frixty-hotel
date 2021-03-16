import { BookingStatus } from "../enums/booking-status";
import mongoose from "mongoose";
import { SupportedCurrencies } from "../enums/supportedCurrencies";

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
      paymentCurrency: {
        type: String,
        enum: Object.values(SupportedCurrencies),
        required: true,
      },
    },
  },
};

export { bookingDetailsObject };
