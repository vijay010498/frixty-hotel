const titleAdditionalPayObject = {
  title: {
    type: String,
    uppercase: true,
    required: true,
  },
  isAdditionalPay: {
    type: Boolean,
    default: false,
  },
  _id: false,
};

export { titleAdditionalPayObject };
