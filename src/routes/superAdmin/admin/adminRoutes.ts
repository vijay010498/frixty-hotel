import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Password } from "../../../services/auth/password";
import { Admin } from "../../../models/Admin";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
import { validateRequest } from "../../../errors";
import { Hotel } from "../../../models/Hotel";
import mongoose from "mongoose";

const router = express.Router({
  caseSensitive: true,
});
router.post(
  "/api/secure/sAdmin/createAdmin",
  [],
  validateRequest,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const ADMIN_BUCKET =
      "https://chill-in-admin-files.s3.ap-south-1.amazonaws.com";
    const { account, hotel, imageUrl, document, adminId, hotelId } = req.body;
    try {
      const hotelAddress = {
        street: hotel.hotelstreet,
        city: hotel.hotelcity,
        area: hotel.hotelarea,
        state: hotel.hotelstate,
        pinCode: parseInt(hotel.hotelpincode),
        country: hotel.hotelcountry,
      };
      const admin = Admin.build({
        _id: adminId,
        email: account.email,
        fullName: account.fullname,
        // @ts-ignore
        hotelAddress,
        hotelId: hotelId,
        hotelName: hotel.hotelname,
        document: `${ADMIN_BUCKET}/${document}`,
        imageUrl: `${ADMIN_BUCKET}/${imageUrl}`,
        password: account.password,
        phoneNumber: account.phonenumber,
      });
      await admin.save();
      res.status(200).send(admin);
      return;
    } catch (err) {
      console.error(err);
      res.status(403).send(err);
      return;
    }
  }
);
router.get(
  "/api/secure/sAdmin/getAdminAndHotelId",
  [],
  validateRequest,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const adminId = mongoose.Types.ObjectId();
    const hotelId = mongoose.Types.ObjectId();
    res.status(200).send({
      adminId,
      hotelId,
    });
    return;
  }
);
router.get(
  "/api/secure/sAdmin/getAllAdmins",
  requireSuperAdmin,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const admins = await Admin.find();
      if (admins.length === 0) {
        res.status(403).send({});
        return;
      }
      res.status(200).send({
        admins,
      });
    } catch (err) {
      console.error(err);
      res.status(403).send(err);
      return;
    }
  }
);

export { router as superAdminAdminRouter };
