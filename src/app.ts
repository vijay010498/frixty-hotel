import express from "express";
import "express-async-errors";
import { json } from "express";
import cookieParser from "cookie-parser";
//all routes imports
import { userAuthRouter } from "./routes/users/auth/authRoutes";
import { getHotelByID } from "./routes/users/hotel/getHotelByID";
import { searchHotelRouter } from "./routes/users/hotel/searchHotel";

//super admin
import { superAdminConfigRouter } from "./routes/superAdmin/config/configRoutes";
import { superAdminBookingRouter } from "./routes/superAdmin/booking/bookingRoutes";
import { SuperAdminGeneralRouter } from "./routes/superAdmin/general/generalRoutes";
import { superAdminAuthRoutes } from "./routes/superAdmin/auth/authRoutes";
import { superAdminAdminRouter } from "./routes/superAdmin/admin/adminRoutes";
import { superAdminHotelRouter } from "./routes/superAdmin/hotel/hotelRoutes";
import { superAdminUploadRouter } from "./routes/superAdmin/upload/uploadRoutes";
import { superAdminSubscriptionRouter } from "./routes/superAdmin/subscription/subscriptionRoutes";
import { superAdminDashboardRouter } from "./routes/superAdmin/dashboard/dashboardRoutes";
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
app.use(cookieParser());
app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV === "production",
  })
);
app.use(limiter);
app.set("trust proxy", true);

app.use(userAuthRouter);
app.use(getHotelByID);
app.use(searchHotelRouter);

//super admin
app.use(superAdminAuthRoutes);
app.use(superAdminHotelRouter);
app.use(superAdminConfigRouter);
app.use(superAdminBookingRouter);
app.use(SuperAdminGeneralRouter);
app.use(superAdminAdminRouter);
app.use(superAdminUploadRouter);
app.use(superAdminSubscriptionRouter);
app.use(superAdminDashboardRouter);
app.use(errorhandler);
app.all("*", async (req, res) => {
  throw new NotFoundError();
});
export { app };
