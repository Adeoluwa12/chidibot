import express from "express";
import path from "path";
import mongoose from "mongoose";
import { loginAndWaitFor2FA, fetchReferrals } from "./utils/bot";
import { MemberModel } from "./models/member";
import { LogModel } from "./models/log";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "./views"));
app.use(express.static(path.join(__dirname, "../public")));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI!)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Dashboard route
app.get("/dashboard", async (req, res) => {
  const members = await MemberModel.find().sort({ detectedAt: -1 }).limit(20);
  const logs = await LogModel.find().sort({ timestamp: -1 }).limit(20);
  res.render("dashboard", { title: "Dashboard", members, logs });
});

// Route for "I’m Done" button
app.post("/done", (req, res) => {
  fs.writeFileSync("2fa_done.txt", "done");
  res.sendStatus(200);
});

// Start the server
app.listen(5555, () => {
  console.log("🚀 Server running on port 5555");

  // Start the bot
  loginAndWaitFor2FA().then(() => {
    setInterval(fetchReferrals, 60 * 9000); // Check 3 minute
  });
});
