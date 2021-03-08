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
  },
  totalRooms: {
    type: Number,
    required: true,
  },
  priceForOneNight: {
    type: Number,
    required: true,
  },
  isBreakfastIncluded: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
    required: true,
  },
  facilities: {
    type: [
      {
        type: String,
        uppercase: true,
      },
    ],
  },
  amenities: {
    type: [
      {
        type: String,
        uppercase: true,
      },
    ],
  },
  isRefundable: {
    type: Boolean,
    default: false,
  },
  images: {
    type: [String],
  },
};

export { roomsObject };
