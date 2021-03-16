import { titleObject } from "./titleObject";

const bedObject = {
  name: {
    type: String,
    required: true,
    uppercase: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  _id: false,
};

const roomsObject = {
  roomType: {
    type: String,
    required: true,
    uppercase: true,
  },
  bedType: [bedObject],
  sleeps: {
    type: Number,
    required: true,
    index: true,
  },
  totalRooms: {
    type: Number,
    required: true,
  },
  priceForOneNight: {
    type: Number,
    required: true,
    index: true,
  },
  discount: {
    isDiscount: {
      type: Boolean,
      default: false,
      required: true,
    },
    discountPercentage: {
      type: Number,
      default: 0.0,
      required: true,
    },
  },
  isBreakfastIncluded: {
    type: Boolean,
    default: false,
    index: true,
  },
  description: {
    type: String,
    required: true,
  },
  amenities: [titleObject],
  isRefundable: {
    type: Boolean,
    default: false,
    index: true,
  },
  images: {
    type: [String],
  },
  isServiceable: {
    type: Boolean,
    default: false,
    index: true,
  },
};

export { roomsObject };
