import mongoose from "mongoose";
const keys = require("./config/keys");

import { app } from "./app";

const start = async () => {
  if (process.env.NODE_ENV) {
    if (!process.env.mongoURI) {
      throw new Error("MONGOURI must be defined");
    }
    if (!process.env.sendgridAPI) {
      throw new Error("sendgridAPI must be defined");
    }
    if (!process.env.forgotPasswordOTPTemplate) {
      throw new Error("forgotPasswordOTPTemplate must be defined");
    }
    if (!process.env.jwtKey) {
      throw new Error("jwtKey must be defined");
    }
    if (!process.env.JWTEXPIRETIME) {
      throw new Error("JWTEXPIRETIME must be defined");
    }
  }
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
