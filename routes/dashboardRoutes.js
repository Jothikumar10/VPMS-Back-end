const express = require("express");
const router = express.Router();

const { getDashboard } = require("../controllers/dashboardController");
const { protect } = require("../middleware/auth");

console.log("Dashboard routes loaded");

router.get("/", (req, res) => {
  res.json({ message: "Dashboard route is working" });
});

module.exports = router;