// (Combined PhilSMS and Helmet Impact Backend)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000; // Use Render's PORT or 3000 locally

// Middleware
app.use(cors()); 
app.use(express.json());

const PHIL_SMS_API_TOKEN = process.env.PHIL_SMS_API_TOKEN;
const PHIL_SMS_SENDER_ID = process.env.PHIL_SMS_SENDER_ID;

if (!PHIL_SMS_API_TOKEN || !PHIL_SMS_SENDER_ID) {
        console.error("FATAL ERROR: PHIL_SMS_API_TOKEN or PHIL_SMS_SENDER_ID missing in environment variables.");
        process.exit(1);
}

const PHIL_SMS_ENDPOINT = 'https://app.philsms.com/api/v3/sms/send';

// Helmet Impact State Storage
let latestImpactState = [false, false, false, false]; // [F, B, L, R]

// API Endpoint the Frontend Calls (PhilSMS)
app.post('/api/send-philsms', async (req, res) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Received request on /api/send-philsms`);

        const { recipients, message } = req.body;
        const phoneNumbers = Array.isArray(recipients) ? recipients : [];

        if (phoneNumbers.length === 0 || !message) {
                console.error(`[${timestamp}] Validation Error: Missing recipients or message.`);
                return res.status(400).json({ error: 'Missing required data (recipients, message).' });
        }

        const formattedNumbers = phoneNumbers.map(number => {
                let num = String(number).trim();
                if (num.startsWith('+63') && num.length === 13) return num.substring(1);
                if (num.startsWith('09') && num.length === 11) return '63' + num.substring(1);
                if (num.startsWith('639') && num.length === 12) return num;
                console.warn(`[${timestamp}] Invalid or unexpected number format: ${num}. Skipping.`);
                return null;
        }).filter(num => num !== null);

        if (formattedNumbers.length === 0) {
                console.error(`[${timestamp}] Validation Error: No valid formatted recipient numbers found.`);
                return res.status(400).json({ error: 'No valid recipient numbers found after formatting.' });
        }

        const recipientString = formattedNumbers.join(',');
        console.log(`[${timestamp}] Formatted recipients string: ${recipientString}`);

        const requestBody = {
                recipient: recipientString,
                sender_id: PHIL_SMS_SENDER_ID,
                type: "plain",
                message: message,
        };
        const requestHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${PHIL_SMS_API_TOKEN}`
        };

        console.log(`[${timestamp}] Calling PhilSMS API at ${PHIL_SMS_ENDPOINT}...`);

        try {
                const apiResponse = await fetch(PHIL_SMS_ENDPOINT, {
                        method: 'POST',
                        headers: requestHeaders,
                        body: JSON.stringify(requestBody),
                });

                let responseData;
                try {
                        responseData = await apiResponse.json();
                } catch (parseError) {
                        const responseText = await apiResponse.text();
                        console.error(`[${timestamp}] PhilSMS API returned non-JSON response: Status ${apiResponse.status}, Body: ${responseText}`);
                        return res.status(502).json({ result: [{ success: false, error: `PhilSMS API returned unexpected response (Status ${apiResponse.status}). Check backend logs.`, number: recipientString }] });
                }

                if (!apiResponse.ok || responseData.status !== 'success') {
                        console.error(`[${timestamp}] PhilSMS API Error: Status ${apiResponse.status}, Response:`, responseData);
                        res.status(apiResponse.status >= 400 && apiResponse.status < 500 ? 400 : 500).json({ result: [{ success: false, error: `PhilSMS Error: ${responseData.message || apiResponse.statusText || 'Unknown API error'}`, number: recipientString }] });
                } else {
                        console.log(`[${timestamp}] PhilSMS Success:`, responseData);
                        res.status(200).json({ result: [{ success: true, details: responseData, number: recipientString }] });
                }
        } catch (error) {
                console.error(`[${timestamp}] Network or processing error calling PhilSMS:`, error);
                res.status(500).json({ result: [{ success: false, error: `Backend Error: ${error.message}`, number: recipientString }] });
        }
});


// API Routes for Helmet Impact

/**
 * @route     POST /api/impact
 * @desc        Receives impact data array from the ESP32
 */
app.post('/api/impact', (req, res) => {
    const impactArray = req.body;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Received POST /api/impact:`, impactArray);

    if (Array.isArray(impactArray) && impactArray.length === 4 && impactArray.every(val => typeof val === 'boolean')) {
        latestImpactState = impactArray;
        console.log(`[${timestamp}] Updated latestImpactState:`, latestImpactState);
        res.status(200).json({ message: "Impact array received successfully", state: latestImpactState });
    } else {
        console.warn(`[${timestamp}] Received invalid data format for /api/impact:`, impactArray);
        res.status(400).json({ message: "Invalid data format. Expecting a JSON array with 4 boolean elements." });
    }
});

/**
 * @route     GET /api/latest-impact
 * @desc        Provides the latest impact data array to the frontend website
 */
app.get('/api/latest-impact', (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Sending GET /api/latest-impact:`, latestImpactState);
    res.status(200).json({
        impactState: latestImpactState,
        lastUpdated: timestamp
    });
});


app.get('/', (req, res) => {
        res.send('Combined Backend Service (PhilSMS + Helmet Impact) is running!');
});

// Start Server
app.listen(port, '0.0.0.0', () => {
        console.log(`✅ Combined Backend Service listening on port ${port}`);
        console.log(`     Frontend should call PhilSMS endpoint: /api/send-philsms`);
        console.log(`     ESP32 should POST to endpoint: /api/impact`);
        console.log(`     Frontend should GET helmet status from: /api/latest-impact`);
        console.log(`     Current server time in Philippines: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
});