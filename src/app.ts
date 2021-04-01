import express from "express";
import "express-async-errors";
import { json } from "express";
import cookieParser from "cookie-parser";
//all routes imports
import { userAuthRouter } from "./routes/users/auth/authRoutes";
import { getHotelByID } from "./routes/users/hotel/getHotelByID";
import { searchHotelRouter } from "./routes/users/hotel/searchHotel";

//Admin
import { adminAuthRouter } from "./routes/admin/auth/authRoutes";

//super admin
import { superAdminBookingRouter } from "./routes/superAdmin/booking/bookingRoutes";
import { SuperAdminGeneralRouter } from "./routes/superAdmin/general/generalRoutes";
import { superAdminAuthRoutes } from "./routes/superAdmin/auth/authRoutes";
import { superAdminAdminRouter } from "./routes/superAdmin/admin/adminRoutes";
import { superAdminHotelRouter } from "./routes/superAdmin/hotel/hotelRoutes";
import { superAdminUploadRouter } from "./routes/superAdmin/upload/uploadRoutes";
import { superAdminSubscriptionRouter } from "./routes/superAdmin/subscription/subscriptionRoutes";
import { superAdminDashboardRouter } from "./routes/superAdmin/dashboard/dashboardRoutes";
import { superAdminChargesRouter } from "./routes/superAdmin/charges/chargesRoutes";
import cookieSession from "cookie-session";
const keys = require("./config/keys");
//error handlers
import { errorhandler } from "./errors";
import { NotFoundError } from "./errors";
const RateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
import redis from "redis";

//redis client
const client = redis.createClient({
  port: 11470,
  password: keys.redisPassword,
  host: keys.redisHost,
});
const limiter = new RateLimit({
  store: new RedisStore({
    client: client,
    prefix: "RL",
    expiry: 60, // 60 seconds
  }),
  max: 50, // max 50 requests in 60 seconds
});

const app = express();
app.use(json());
//app.use(limiter);
app.use(cookieParser());
app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV === "production",
  })
);

app.set("trust proxy", true);

app.use(userAuthRouter);
app.use(getHotelByID);
app.use(searchHotelRouter);

//super admin
app.use(superAdminAuthRoutes);
app.use(superAdminHotelRouter);
app.use(superAdminBookingRouter);
app.use(SuperAdminGeneralRouter);
app.use(superAdminAdminRouter);
app.use(superAdminUploadRouter);
app.use(superAdminSubscriptionRouter);
app.use(superAdminDashboardRouter);
app.use(superAdminChargesRouter);

//admin
app.use(adminAuthRouter);

app.use(errorhandler);
app.all("*", async (req, res) => {
  throw new NotFoundError();
});
export { app };
