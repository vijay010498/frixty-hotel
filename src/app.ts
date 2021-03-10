import express from "express";
import "express-async-errors";
import { json } from "express";
//all routes imports
import { signupRouter } from "./routes/auth/users/signup";
import { signInRouter } from "./routes/auth/users/signin";
import { createHotelRouter } from "./routes/hotel/sAdmin/createHotel";
import { getHotelByID } from "./routes/hotel/getHotelByID";
import { getAllHotelsRouter } from "./routes/hotel/getAllHotels";
import { searchHotelByStateRouter } from "./routes/hotel/searchHotel";
import { requestOTPRouter } from "./routes/auth/users/requestOTP";
import { verifyOTPRouter } from "./routes/auth/users/verifyOTPAndChangePassword";
import { changePasswordRouter } from "./routes/auth/users/changePassword";

const RateLimit = require("express-rate-limit");
//error handlers
import { errorhandler } from "./errors";
import { NotFoundError } from "./errors";
const limiter = new RateLimit({
  windowMs: 60 * 1000,
  max: 25,
});

const app = express();
app.use(json());
app.use(limiter);
app.set("trust proxy", true);
app.use(signupRouter);
app.use(signInRouter);
app.use(createHotelRouter);
app.use(getHotelByID);
app.use(getAllHotelsRouter);
app.use(searchHotelByStateRouter);
app.use(requestOTPRouter);
app.use(verifyOTPRouter);
app.use(changePasswordRouter);
app.use(errorhandler);

app.all("*", async (req, res) => {
  throw new NotFoundError();
});
export { app };
