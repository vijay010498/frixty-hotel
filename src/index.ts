import mongoose from "mongoose";
const keys = require("./config/keys");

import { app } from "./app";

const start = async () => {
  try {
    await mongoose.connect(keys.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    });
  } catch (err) {
    console.error(err);
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log("listening on port 5000");
  });
};

start();
