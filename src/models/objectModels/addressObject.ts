//addressObject
const addressObject = {
  street: {
    type: String,
    uppercase: true,
    required: true,
    index: true,
  },
  city: {
    type: String,
    uppercase: true,
    required: true,
    index: true,
  },
  area: {
    type: String,
    uppercase: true,
    required: true,
    index: true,
  },
  state: {
    type: String,
    uppercase: true,
    required: true,
    index: true,
  },
  pinCode: {
    type: Number,
    required: true,
    index: true,
  },
  country: {
    type: String,
    uppercase: true,
    required: true,
    index: true,
  },
};

export { addressObject };
