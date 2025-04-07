require('dotenv').config(); // Load variables from .env file
const express = require('express');
const fetch = require('node-fetch'); // Use require for node-fetch v2
const cors = require('cors'); // Import CORS package

const app = express();
const port = process.env.PORT || 3000; // Use Render's PORT or 3000 locally

// --- Middleware ---
// Consider restricting CORS in production: cors({ origin: 'YOUR_FRONTEND_URL' })
app.use(cors()); // Allow requests from your frontend (adjust for production)
app.use(express.json()); // Parse JSON request bodies

// --- Get PhilSMS Credentials & Config ---
// THESE MUST BE SET AS ENVIRONMENT VARIABLES (in .env locally, or platform settings when deployed)
const PHIL_SMS_API_TOKEN = process.env.PHIL_SMS_API_TOKEN; // Your actual token from app.philsms.com
const PHIL_SMS_SENDER_ID = process.env.PHIL_SMS_SENDER_ID; // Your registered Sender ID from app.philsms.com

// --- Basic Configuration Check ---
if (!PHIL_SMS_API_TOKEN || !PHIL_SMS_SENDER_ID) {
    console.error("FATAL ERROR: PHIL_SMS_API_TOKEN or PHIL_SMS_SENDER_ID missing in environment variables.");
    // Don't crash in production ideally, maybe return an error state
    process.exit(1); // Exit if essential config is missing during startup
}

// --- PhilSMS API Endpoint ---
const PHIL_SMS_ENDPOINT = 'https://app.philsms.com/api/v3/sms/send'; // Official PhilSMS API endpoint

// --- API Endpoint the Frontend Calls ---
app.post('/api/send-philsms', async (req, res) => {
    console.log('Received request on /api/send-philsms');

    // --- Get Data from Frontend ---
    const { recipients, message } = req.body; // Expecting ARRAY of numbers, message
    const phoneNumbers = Array.isArray(recipients) ? recipients : [];

    // --- Validate Inputs ---
    if (phoneNumbers.length === 0 || !message) {
        console.error("Validation Error: Missing recipients or message.");
        return res.status(400).json({ error: 'Missing required data (recipients, message).' });
    }

    // --- Format Numbers & Create Recipient String ---
    const formattedNumbers = phoneNumbers.map(number => {
        let num = String(number).trim(); // Ensure it's a string before trimming
        if (num.startsWith('+63') && num.length === 13) {
            return num.substring(1); // Remove '+' -> 639...
        } else if (num.startsWith('09') && num.length === 11) {
            return '63' + num.substring(1); // Convert 09... -> 639...
        } else if (num.startsWith('639') && num.length === 12) {
            return num; // Already in desired format 639...
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
    // Matches the documentation parameters
    const requestBody = {
        recipient: recipientString,
        sender_id: PHIL_SMS_SENDER_ID,
        type: "plain", // Use "plain" as per docs
        message: message,
    };

    // Matches the documentation headers
    const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${PHIL_SMS_API_TOKEN}` // Use Bearer token auth
    };

    console.log(`Calling PhilSMS API at ${PHIL_SMS_ENDPOINT}...`);

    // --- Make Single API Call to PhilSMS ---
    try {
        const apiResponse = await fetch(PHIL_SMS_ENDPOINT, { // Using the CORRECT endpoint now
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestBody),
        });

        // Attempt to parse response regardless of status, but handle potential errors
        let responseData;
        try {
            responseData = await apiResponse.json(); // Try to parse JSON
        } catch (parseError) {
            // If JSON parsing fails, read as text (could be HTML error page from API/proxy)
            const responseText = await apiResponse.text();
            console.error(`PhilSMS API returned non-JSON response: Status ${apiResponse.status}, Body: ${responseText}`);
            return res.status(502).json({ // 502 Bad Gateway suggests upstream issue
                 result: [{ success: false, error: `PhilSMS API returned unexpected response (Status ${apiResponse.status}). Check backend logs.`, number: recipientString }]
            });
        }


        // Check response based on PhilSMS documentation structure
        // Use responseData.status (lowercase 's') as per docs
        if (!apiResponse.ok || responseData.status !== 'success') {
            console.error(`PhilSMS API Error: Status ${apiResponse.status}, Response:`, responseData);
            // Send error back to frontend using message from API if available
            res.status(apiResponse.status >= 400 && apiResponse.status < 500 ? 400 : 500).json({ // Use 400 for client errors, 500 otherwise
                result: [{ success: false, error: `PhilSMS Error: ${responseData.message || apiResponse.statusText || 'Unknown API error'}`, number: recipientString }]
            });
        } else {
            // status is "success"
            console.log(`PhilSMS Success:`, responseData);
            // Send success back to frontend
             res.status(200).json({
                 result: [{ success: true, details: responseData, number: recipientString }]
             });
        }
    } catch (error) {
        // This catches network errors (fetch failing) or errors thrown manually above
        console.error(`Network or processing error calling PhilSMS:`, error);
        // Send internal server error back to frontend
        res.status(500).json({
             result: [{ success: false, error: `Backend Error: ${error.message}`, number: recipientString }]
        });
    }
});

// --- Start Server ---
app.listen(port, '0.0.0.0', () => { // Listen on 0.0.0.0 for Render compatibility
    console.log(`✅ SMS Backend (PhilSMS) listening on port ${port}`);
    console.log(`   Frontend should call endpoint: /api/send-philsms`);
});