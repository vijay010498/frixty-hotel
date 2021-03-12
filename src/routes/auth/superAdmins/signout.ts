import express from "express";
const router = express.Router({
  caseSensitive: true,
});

router.post("/api/secure/sAdmin/signOut", (req, res) => {
  req.session = null;

  res.status(200).send({
    message: "Successfully Signed Out",
  });
});

export { router as superAdminSignOutRouter };
