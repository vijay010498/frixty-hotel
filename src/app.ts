import express from "express";
import "express-async-errors";
import { json } from "express";
//all routes imports
import { signupRouter } from "./routes/auth/signup";
import { signInRouter } from "./routes/auth/signin";

//error handlers
import { errorhandler } from "./errors";
import { NotFoundError } from "./errors";

const app = express();
app.use(json());
app.set("trust proxy", true);
app.use(signupRouter);
app.use(signInRouter);
app.use(errorhandler);

app.all("*", async (req, res) => {
  throw new NotFoundError();
});
export { app };
