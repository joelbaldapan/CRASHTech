require('dotenv').config(); // Load variables from .env file
const express = require('express');
const fetch = require('node-fetch'); // Use require for node-fetch v2
const cors = require('cors'); // Import CORS package

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
const frontendOrigin = 'http://127.0.0.1:5500'; // Or your deployed frontend URL (e.g., GitHub Pages URL)
app.use(cors({ origin: frontendOrigin })); // Allow requests from your frontend
// For broad testing: app.use(cors());

app.use(express.json()); // Parse JSON request bodies

// --- Get PhilSMS Credentials & Config ---
// THESE MUST BE SET AS ENVIRONMENT VARIABLES (in .env locally, or platform settings when deployed)
const PHIL_SMS_API_TOKEN = process.env.PHIL_SMS_API_TOKEN; // Changed from KEY to TOKEN based on docs
const PHIL_SMS_SENDER_ID = process.env.PHIL_SMS_SENDER_ID;

// --- Basic Configuration Check ---
if (!PHIL_SMS_API_TOKEN || !PHIL_SMS_SENDER_ID) {
    console.error("FATAL ERROR: PHIL_SMS_API_TOKEN or PHIL_SMS_SENDER_ID missing in environment variables.");
    process.exit(1);
}

// --- PhilSMS API Endpoint ---
const PHIL_SMS_ENDPOINT = 'https://app.philsms.com/api/v3/sms/send'; // From Docs

// --- API Endpoint the Frontend Calls ---
app.post('/api/send-philsms', async (req, res) => { // Changed path slightly for clarity
    console.log('Received request on /api/send-philsms');

    // --- Get Data from Frontend ---
    const { recipients, message /*, passcode */ } = req.body; // Expecting ARRAY of numbers, message
    const phoneNumbers = Array.isArray(recipients) ? recipients : [];

    // --- Validate Inputs ---
    if (phoneNumbers.length === 0 || !message /* || !passcode */) {
        console.error("Validation Error: Missing recipients or message.");
        return res.status(400).json({ error: 'Missing required data (recipients, message).' });
    }

    // --- Format Numbers & Create Recipient String ---
    const formattedNumbers = phoneNumbers.map(number => {
        let num = number.trim();
        if (num.startsWith('+63') && num.length === 13) {
            return num.substring(1); // Remove '+' -> 639...
        } else if (num.startsWith('09') && num.length === 11) {
            return '63' + num.substring(1); // Convert 09... -> 639...
        } else if (num.startsWith('639') && num.length === 12) {
             return num; // Already in desired format
        } else {
            console.warn(`Invalid or unexpected number format: ${num}. Skipping.`);
            return null; // Mark as invalid
        }
    }).filter(num => num !== null); // Remove any invalid numbers

    if (formattedNumbers.length === 0) {
         console.error("Validation Error: No valid formatted recipient numbers found.");
         return res.status(400).json({ error: 'No valid recipient numbers found after formatting.' });
    }

    const recipientString = formattedNumbers.join(','); // Join with comma for PhilSMS API
    console.log(`Formatted recipients string: ${recipientString}`);

    // --- Construct PhilSMS Request ---
    const requestBody = {
        recipient: recipientString,
        sender_id: PHIL_SMS_SENDER_ID,
        type: "plain", // Use "plain" as per docs
        message: message,
    };

    const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${PHIL_SMS_API_TOKEN}` // Use Bearer token auth
    };

    console.log(`Calling PhilSMS API at ${PHIL_SMS_ENDPOINT}...`);

    // --- Make Single API Call to PhilSMS ---
    try {
        const apiResponse = await fetch(PHIL_SMS_ENDPOINT, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestBody),
        });

        const responseData = await apiResponse.json(); // Parse response body

        // Check response based on PhilSMS documentation structure
        if (!apiResponse.ok || responseData.status !== 'success') {
            console.error(`PhilSMS API Error: Status ${apiResponse.status}, Response:`, responseData);
            // Send error back to frontend, mimicking the previous structure for compatibility
            res.status(apiResponse.status || 500).json({
                 result: [{ success: false, error: `PhilSMS Error: ${responseData.message || apiResponse.statusText || 'Unknown API error'}`, number: recipientString }] // Report failure for the whole batch
            });
        } else {
            console.log(`PhilSMS Success:`, responseData);
            // Send success back to frontend, mimicking previous structure
             res.status(200).json({
                 result: [{ success: true, details: responseData, number: recipientString }] // Report success for the whole batch
             });
        }
    } catch (error) {
        console.error(`Network or parsing error calling PhilSMS:`, error);
        // Send internal server error back to frontend
        res.status(500).json({
             result: [{ success: false, error: `Backend Fetch/Network Error: ${error.message}`, number: recipientString }]
        });
    }
}); // end app.post

// --- Start Local Server ---
app.listen(port, () => {
    console.log(`✅ SMS Backend (PhilSMS) listening at http://localhost:${port}`);
    console.log(`   Frontend should call: http://localhost:${port}/api/send-philsms`); // Updated path
    console.log(`   Ensure frontend origin (${frontendOrigin}) is allowed by CORS.`);
});