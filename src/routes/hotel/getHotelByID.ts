import express, { Request, Response } from "express";
import { body, param } from "express-validator";

import { BadRequestError, NotFoundError, validateRequest } from "../../errors";
import { Hotel } from "../../models/Hotel";

const router = express.Router();

router.get(
  "/api/v1/hotels/search/:id",
  [param("id").isString().withMessage("Id Must Be String")],
  validateRequest,
  async (req: Request, res: Response) => {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      throw new BadRequestError("No Hotel Found");
    }
    res.status(200).send(hotel);
    return;
  }
);

export { router as getHotelByID };
