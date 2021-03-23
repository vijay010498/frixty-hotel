import { query } from "express-validator";

const AWS = require("aws-sdk");
const uuid = require("uuid");
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
import express, { Request, Response } from "express";
import { validateRequest } from "../../../errors";
const keys = require("../../../config/keys");
const S3 = new AWS.S3({
  accessKeyId: keys.awsAccessKeyId,
  secretAccessKey: keys.awsSecretKeyId,
  region: "ap-south-1",
});
const router = express.Router({
  caseSensitive: true,
});
router.get(
  "/api/secure/sAdmin/uploadAdminFiles",
  requireSuperAdmin,
  [
    query("adminId").isMongoId().withMessage("Admin Id Cannot be empty"),
    query("fileName").isString().withMessage("File Name Cannot be Empty"),
    query("fileType").isString().withMessage("File Type Cannot be Empty"),
    query("contentType").isString().withMessage("Content Type Cannot be Empty"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const adminId = req.query.adminId;
    const fileName = req.query.fileName;
    const filetype = req.query.fileType;
    const contentType = req.query.contentType;
    const folderName = req.query.folderName || "General";
    const key = `${adminId}/${folderName}/${fileName}-${uuid.v1()}.${filetype}`;
    S3.getSignedUrl(
      "putObject",
      {
        Bucket: "chill-in-admin-files",
        ContentType: contentType,
        Key: key,
      },
      (err: any, url: any) => {
        console.log(key, url);
        res.send({ key, url });
      }
    );
  }
);
export { router as superAdminUploadRouter };
