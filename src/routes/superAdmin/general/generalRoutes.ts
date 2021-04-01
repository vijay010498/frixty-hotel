import express, { Request, Response } from "express";
import { validateRequest } from "../../../errors";
import { requireSuperAdmin } from "../../../errors/middleware/SAdmin/require-super-admin";
import { ExchangeRatesCache } from "../../../models/Cache/ExchangeRatesCache";
import axios from "axios";
const alphabetize = require("alphabetize-object-keys");
const keys = require("../../../config/keys");
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
      const exchangeRatesCache = await ExchangeRatesCache.findOne({
        base: baseCurrency,
      });
      if (!exchangeRatesCache) {
        console.log("Currency Rates Not Serving from cache");
        const response = await axios.get(
          "https://api.exchangeratesapi.io/latest",
          {
            params: {
              access_key: keys.exchangeRatesApi,
              base: baseCurrency,
            },
          }
        );
        const saveExchangeRatesCache = ExchangeRatesCache.build({
          base: baseCurrency,
          rates: response.data.rates,
        });
        await saveExchangeRatesCache.save();
        const sortedOrder = await alphabetize(response.data.rates);
        res.cookie("baseCurrency", baseCurrency);
        res.status(200).send(sortedOrder);
        return;
      } else {
        console.log("Currency Rates Serving from cache");
        const sortedOrder = await alphabetize(exchangeRatesCache.rates);
        res.cookie("baseCurrency", baseCurrency);
        res.status(200).send(sortedOrder);
        return;
      }
    } catch (err) {
      res.status(403).send(err);
      return;
    }
  }
);

export { router as SuperAdminGeneralRouter };
