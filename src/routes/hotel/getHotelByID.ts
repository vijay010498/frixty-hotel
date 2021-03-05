import express, { Request, Response } from "express";
import { body, param } from "express-validator";

import { NotFoundError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";

const router = express.Router();

router.get(
  "/api/v1/hotels/search/:id",
  [param("id").isString().withMessage("Id Must Be String")],
  validateRequest,
  async (req: Request, res: Response) => {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      throw new NotFoundError();
    }
    res.send(hotel).status(200);
  }
);

export { router as getHotelByID };
