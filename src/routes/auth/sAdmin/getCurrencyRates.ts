import express, { Request, Response } from "express";
import { exchangeRates } from "exchange-rates-api";
import { validateRequest } from "../../../errors";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
const alphabetize = require("alphabetize-object-keys");
const router = express.Router({
  caseSensitive: true,
});
const defaultBaseCurrency = "MYR";

router.get(
  "/api/secure/sAdmin/getExchangeRates",
  requireSuperAdmin,
  [],
  validateRequest,
  async (req: Request, res: Response) => {
    const baseCurrency =
      req.query.baseCurrency || req.cookies.baseCurrency || defaultBaseCurrency;

    try {
      const response = await exchangeRates()
        .latest() // @ts-ignore
        .base(baseCurrency)
        .fetch();
      const sortedOrder = await alphabetize(response);
      res.cookie("baseCurrency", baseCurrency);
      res.status(200).send(sortedOrder);
      return;
    } catch (err) {
      res.status(403).send(err);
      return;
    }
  }
);

export { router as SuperAdminGetExchangeRouter };
