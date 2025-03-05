import * as puppeteer from "puppeteer";
import axios, { AxiosError } from "axios";
import { sendNotification } from "./notifier";
import { MemberModel } from "../models/member";
import { LogModel } from "../models/log";
import fs from "fs";

const LOGIN_URL = "https://apps.availity.com/login";
const AVAILITY_API_URL = "https://apps.availity.com/api/v1/proxy/anthem/provconn/v1/carecentral/ltss/referral/details";
const COOKIE_FILE = "cookies.json";

let cookies: puppeteer.Cookie[] = [];

// Login and wait for 2FA
export const loginAndWaitFor2FA = async () => {
  console.log("Launching browser for login...");

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to the login page
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });

    // Fill in the login form
    await page.type('input[name="userId"]', process.env.AVAILITY_USER_ID!);
    await page.type('input[name="password"]', process.env.AVAILITY_PASSWORD!);
    await page.click('button[type="submit"]');

    // Notify the user to complete 2FA
    await sendNotification("Please complete the 2FA process in the browser and click the 'I’m Done' button on the dashboard.");

    // Wait for the user to click the "I’m Done" button
    console.log("Waiting for user to complete 2FA...");
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (fs.existsSync("2fa_done.txt")) {
          clearInterval(interval);
          resolve(null);
        }
      }, 1000);
    });

    // Get the cookies after login
    cookies = await page.cookies();
    console.log("✅ Cookies fetched successfully:", cookies);

    // Save cookies to a file
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    console.log("🍪 Cookies saved to", COOKIE_FILE);

    // Extract the XSRF token from cookies
    const xsrfToken = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
    if (xsrfToken) {
      console.log("🔑 XSRF-TOKEN:", xsrfToken);
    } else {
      console.log("❌ XSRF-TOKEN not found in cookies.");
    }

    // Fetch and log the members list after successful login
    await fetchReferrals(xsrfToken);
  } catch (error) {
    console.error("❌ Error during login:", error);
  } finally {
    await browser.close();
  }
};

// Fetch referrals
export const fetchReferrals = async (xsrfToken?: string) => {
  try {
    console.log("Fetching referrals from Availity API...");

    // Define the payload
    const payload = {
      brand: "WLP",
      npi: "1184328189",
      papi: "",
      state: "TN",
      tabStatus: "INCOMING",
      taxId: "922753606",
    };

    // Convert cookies to a string for the Cookie header
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Make the API call with cookies and XSRF token
    const response = await axios.post(AVAILITY_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieString,
        "X-XSRF-TOKEN": xsrfToken || "", // Include XSRF token if available
      },
    });

    const referrals = response.data.referrals; // Extract the referrals array
    console.log("Referrals fetched:", referrals);

    // Log the entire members list
    console.log("📝 Members List:", JSON.stringify(referrals, null, 2));

    // Send the members list to the email
    await sendNotification(`Members List:\n${JSON.stringify(referrals, null, 2)}`);

    // Compare with the last fetched referrals
    const lastReferrals = await MemberModel.find().sort({ detectedAt: -1 }).limit(20);
    const lastReferralNames = lastReferrals.map((ref) => ref.memberName);

    const newReferrals = referrals.filter(
      (ref: { memberName: string | null | undefined; }) => !lastReferralNames.includes(ref.memberName)
    );

    if (newReferrals.length > 0) {
      console.log("🎉 New referrals detected:", newReferrals);
      await sendNotification(`New referrals detected: ${newReferrals.map((ref: { memberName: any; }) => ref.memberName).join(", ")}`);

      // Save new referrals to the database
      await MemberModel.insertMany(newReferrals);
    } else {
      console.log("No new referrals detected.");
    }

    // Log the activity
    await LogModel.create({ message: `Fetched ${referrals.length} referrals` });
  } catch (error) {
    console.error("❌ Error fetching referrals:", error);

    // Check if the error is an AxiosError
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        console.log("Session expired. Please log in again.");
        await loginAndWaitFor2FA();
      }
    }
  }
};