import express, { Request, Response } from "express";
import { body } from "express-validator";
import { Password } from "../../../services/auth/password";
import { Admin } from "../../../models/Admin";
import { requireSuperAdminAuth } from "../../../errors/middleware/SAdmin/require-super-admin-auth";
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
  requireSuperAdminAuth,
  async (req: Request, res: Response) => {
    const ADMIN_BUCKET =
      "https://chill-in-admin-files.s3.ap-south-1.amazonaws.com";
    const {
      account,
      hotel,
      adminImageUrl,
      ssmCopyUrl,
      adminId,
      hotelId,
      companyNameBoardImageUrl,
    } = req.body;
    try {
      const hotelAddress = {
        street: hotel.hotelstreet,
        city: hotel.hotelcity,
        area: hotel.hotelarea,
        state: hotel.hotelstate,
        pinCode: parseInt(hotel.hotelpincode),
        country: hotel.hotelcountry,
      };

      const admin = await Admin.build({
        _id: adminId,
        adminImageUrl: `${ADMIN_BUCKET}/${adminImageUrl}`,
        companyName: account.companyname,
        companyNameBoardImageUrl: `${ADMIN_BUCKET}/${companyNameBoardImageUrl}`,
        contactNumber: account.contactnumber,
        email: account.email,
        emergencyContactNumber: account.emergencycontactnumber || "",
        // @ts-ignore
        hotelAddress: hotelAddress,
        hotelId: hotelId,
        hotelName: hotel.hotelname,
        ownerName: account.ownername,
        passportNumber: account.passportnumber,
        password: account.password,
        ssmCopyUrl: `${ADMIN_BUCKET}/${ssmCopyUrl}`,
        ssmNumber: account.ssmnumber,
        whatsappNumber: account.whatsappnumber,
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
  requireSuperAdminAuth,
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
  requireSuperAdminAuth,
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
