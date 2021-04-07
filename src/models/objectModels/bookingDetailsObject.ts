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
  totalGuests: {
    type: Number,
    required: true,
  },
  totalDays: {
    type: Number,
    required: true,
  },
  roomConfiguration: {
    totalRooms: {
      type: Number,
      required: true,
    },
    totalGuestsPerRoom: {
      type: Number,
      required: true,
    },
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
    type: Object,
    required: true,
  },
};

export { bookingDetailsObject };
