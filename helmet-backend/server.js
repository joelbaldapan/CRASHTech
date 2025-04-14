// server.js (Helmet Impact Service ONLY)

const express = require('express');
const cors = require('cors'); // Import CORS package

const app = express();
// Use a distinct default port if running locally alongside the other service, e.g., 3001
const port = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors()); // Allows requests from your frontend (GitHub Pages, local dev)
app.use(express.json()); // Parse JSON request bodies (needed for ESP32 data)

// --- Helmet Impact State Storage ---
// In-memory variable to hold the latest state received from ESP32
// Format: [Front, Back, Left, Right] -> [bool, bool, bool, bool]
let latestImpactState = [false, false, false, false];

// --- API Routes for Helmet Impact ---

/**
 * @route     POST /api/impact
 * @desc        Receives impact data array from the ESP32
 * @access    Public (ESP32 needs to reach this)
 */
app.post('/api/impact', (req, res) => {
    const impactArray = req.body;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Received POST /api/impact:`, impactArray);

    // Validation
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
 * @access    Public (Frontend JS needs to reach this)
 */
app.get('/api/latest-impact', (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Sending GET /api/latest-impact:`, latestImpactState);
    res.status(200).json({
        impactState: latestImpactState,
        lastUpdated: timestamp
    });
});

// --- Optional: Basic Root Route ---
app.get('/', (req, res) => {
        res.send('Helmet Impact Backend Service is running!');
});

// --- Start Server ---
app.listen(port, '0.0.0.0', () => {
        console.log(`✅ Helmet Impact Backend Service listening on port ${port}`);
        console.log(`     ESP32 should POST to endpoint: /api/impact`);
        console.log(`     Frontend should GET from endpoint: /api/latest-impact`);
        console.log(`     Current server time in Philippines: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
});