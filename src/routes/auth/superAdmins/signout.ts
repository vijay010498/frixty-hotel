import express from "express";
const router = express.Router({
  caseSensitive: true,
});

router.post("/api/secure/sAdmin/signOut", (req, res) => {
  req.session = null;

  res.send({});
});

export { router as superAdminSignOutRouter };
