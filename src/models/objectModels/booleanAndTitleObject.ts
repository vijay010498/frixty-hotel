import { titleAdditionalPayObject } from "./titleAdditionalPayObject";

const booleanAndTitleObject = {
  isFree: {
    type: Boolean,
    default: false,
    required: true,
  },
  details: {
    type: [titleAdditionalPayObject],
  },
  _id: false,
};

export { booleanAndTitleObject };
