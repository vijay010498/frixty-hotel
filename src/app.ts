import express from "express";
import "express-async-errors";
import { json } from "express";

//all routes imports
import { signupRouter } from "./routes/auth/users/signup";
import { signInRouter } from "./routes/auth/users/signin";
import { getHotelByID } from "./routes/hotel/getHotelByID";
import { getAllHotelsRouter } from "./routes/hotel/getAllHotels";
import { searchHotelRouter } from "./routes/hotel/searchHotels";
import { requestOTPRouter } from "./routes/auth/users/requestOTP";
import { verifyOTPRouter } from "./routes/auth/users/verifyOTPAndChangePassword";
import { changePasswordRouter } from "./routes/auth/users/changePassword";
import { verifyAuthRouter } from "./routes/auth/users/verifyAuth";

//super admin
import { superAdminSignupRouter } from "./routes/auth/sAdmin/signup";
import { superAdminSignInRouter } from "./routes/auth/sAdmin/signin";
import { superAdminSignOutRouter } from "./routes/auth/sAdmin/signout";
import { superAdminChangePasswordRouter } from "./routes/auth/sAdmin/changePassword";
import { superAdminRequestOTPRouter } from "./routes/auth/sAdmin/requestOTP";
import { superAdminVerifyOTPAndChangePasswordRouter } from "./routes/auth/sAdmin/verifyOTPAndChangePassword";
import { superAdminUpdateGatewayChargesRouter } from "./routes/config/sAdmin/UpdateGatewayCharge";
import { superAdminCreateBookingRouter } from "./routes/hotel/sAdmin/createBookingSAdmin";
import { superAdminCreateHotelRouter } from "./routes/hotel/sAdmin/createHotel";
import cookieSession from "cookie-session";

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
app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV === "production",
  })
);
app.use(limiter);
app.set("trust proxy", true);
app.use(signupRouter);
app.use(signInRouter);
app.use(getHotelByID);
app.use(getAllHotelsRouter);
app.use(searchHotelRouter);
app.use(requestOTPRouter);
app.use(verifyOTPRouter);
app.use(changePasswordRouter);
app.use(verifyAuthRouter);

//super admin
app.use(superAdminSignupRouter);
app.use(superAdminCreateHotelRouter);
app.use(superAdminSignInRouter);
app.use(superAdminSignOutRouter);
app.use(superAdminChangePasswordRouter);
app.use(superAdminRequestOTPRouter);
app.use(superAdminRequestOTPRouter);
app.use(superAdminVerifyOTPAndChangePasswordRouter);
app.use(superAdminUpdateGatewayChargesRouter);
app.use(superAdminCreateBookingRouter);

app.use(errorhandler);

app.all("*", async (req, res) => {
  throw new NotFoundError();
});
export { app };
