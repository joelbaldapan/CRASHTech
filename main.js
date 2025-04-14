// --- DOM Elements ---
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const monitoringStatus = document.getElementById("monitoringStatus");
const display = document.getElementById("display");
const speedLog = document.getElementById("speedLog");

// Settings elements
const userNameInput = document.getElementById("userName");
const phoneNumbersInput = document.getElementById("phoneNumbers");
const speedLimitInput = document.getElementById("speedLimit");
const minSpeedForCrashCheckInput = document.getElementById("minSpeedForCrashCheck");
const maxSpeedAfterCrashInput = document.getElementById("maxSpeedAfterCrash");
const minDecelerationForCrashInput = document.getElementById("minDecelerationForCrash");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");

const philsmsApiUrlInput = document.getElementById("philsmsApiUrlInput");
const helmetApiUrlInput = document.getElementById("helmetApiUrlInput");   // New ID from HTML

// Crash Alert elements
const crashAlertInfo = document.getElementById("crashAlertInfo");
const crashLocationDisplay = document.getElementById("crashLocation");
const smsLink = document.getElementById("smsLink");
const resetCrashBtn = document.getElementById("resetCrashBtn");
const speedAlertSound = document.getElementById("speedAlertSound");

// Test Button Element
const testSmsBtn = document.getElementById("testSmsBtn");

// *** ADDED: Selector for Helmet Status Display ***
const helmetStatusDisplay = document.getElementById("helmetStatusDisplay"); // New ID from HTML

// --- State Variables ---
let isMonitoring = false;
let watchId = null;
let previousSpeedKmH = 0;
let crashDetected = false;
let isSpeeding = false;
let helmetStatusIntervalId = null; // *** ADDED: Interval ID for polling helmet status ***

// --- Constants ---
const LOCATION_TIMEOUT = 15000;
const GEOLOCATION_OPTIONS = { /* ... */ };
const MAX_LOG_ENTRIES = 100;
const STORAGE_PREFIX = 'crashDetector_';

// --- Initialization ---
loadSettings();

// --- Event Listeners ---
startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);
saveSettingsBtn.addEventListener("click", saveSettings);
resetCrashBtn.addEventListener("click", resetCrashAlert);
if (testSmsBtn) { /* ... */ }

// --- Core Functions ---

function startMonitoring() {
    if (isMonitoring) return;

    if (!("geolocation" in navigator)) { /* ... */ return; }
    // *** UPDATED: Read BOTH URLs for validation ***
    const philsmsUrl = philsmsApiUrlInput.value.trim();
    const helmetUrl = helmetApiUrlInput.value.trim();

    // *** UPDATED: Validate ALL settings including BOTH URLs ***
    if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value || !minSpeedForCrashCheckInput.value || !maxSpeedAfterCrashInput.value || !minDecelerationForCrashInput.value || !philsmsUrl || !helmetUrl ) {
        monitoringStatus.textContent = "Error: Please fill in ALL settings fields, including BOTH Backend URLs."; // Adjusted message
        settingsStatus.textContent = "Save ALL settings before starting.";
        settingsStatus.style.color = "red";
        return;
    }
    try {
        new URL(philsmsUrl); // Check PhilSMS URL format
        new URL(helmetUrl);  // Check Helmet URL format
    } catch (_) {
        monitoringStatus.textContent = "Error: Invalid format for one or both Backend API URLs."; // Generic wording
        settingsStatus.textContent = "Check Backend API URLs.";
        settingsStatus.style.color = "red";
        return;
    }

    // Reset state and UI (including helmet status)
    monitoringStatus.textContent = "Status: Starting...";
    monitoringStatus.style.color = "";
    if (helmetStatusDisplay) helmetStatusDisplay.textContent = "Helmet Status: Initializing..."; // Clear helmet display
    crashDetected = false;
    isSpeeding = false;
    display.style.color = '';
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;
    if (speedLog) speedLog.innerHTML = "";

    // Start Geolocation Watch
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(/* ... */);
        isMonitoring = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        monitoringStatus.textContent = "Status: Monitoring speed...";
        console.log("Monitoring started with watchId:", watchId);

        // *** ADDED: Start polling helmet status ***
        fetchHelmetStatus(); // Fetch immediately
        helmetStatusIntervalId = setInterval(fetchHelmetStatus, 3000); // Poll every 3 seconds

    } else { /* ... */ }
}

function stopMonitoring() {
    if (!isMonitoring || watchId === null) return;
    navigator.geolocation.clearWatch(watchId);

    // *** ADDED: Stop polling helmet status ***
    if (helmetStatusIntervalId) {
        clearInterval(helmetStatusIntervalId);
        helmetStatusIntervalId = null;
    }
    if (helmetStatusDisplay) helmetStatusDisplay.textContent = "Helmet Status: Off"; // Update helmet display

    watchId = null;
    isMonitoring = false;
    isSpeeding = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    monitoringStatus.textContent = "Status: Idle";
    display.textContent = "Speed: 0.0 km/h";
    display.style.color = '';
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;
    console.log("Monitoring stopped.");
}

// handlePositionUpdate(...) // No changes needed inside here unless you want to log helmet status too
// handleGeolocationError(...) // No changes needed inside here
// triggerCrashAlert(...) // No changes needed inside here (it calls callBackendForSms)

/**
 * *** UPDATED: Reads PhilSMS Backend URL ***
 * Calls the configured PhilSMS Backend API endpoint to trigger SMS sending.
 * @param {number|null} latitude
 * @param {number|null} longitude
 */
function callBackendForSms(latitude, longitude) {
    // *** UPDATED: Read ONLY the PhilSMS URL ***
    const backendUrl = philsmsApiUrlInput.value.trim(); // Use the specific input for PhilSMS

    // --- Validate PhilSMS URL specifically ---
    if (!backendUrl) {
        console.error("Error: PhilSMS Backend API URL is missing in settings.");
        monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Missing PhilSMS Backend URL).";
        crashLocationDisplay.textContent += "\nError: Cannot send alert. PhilSMS Backend URL missing.";
        // Re-enable test button if it was a test attempt
        if (testSmsBtn && testSmsBtn.disabled) testSmsBtn.disabled = false;
        return;
    }
    try { new URL(backendUrl); } catch (_) {
        monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Invalid PhilSMS URL format).";
        crashLocationDisplay.textContent += "\nError: Cannot send alert. Invalid PhilSMS Backend URL format.";
         if (testSmsBtn && testSmsBtn.disabled) testSmsBtn.disabled = false;
        return;
    }

    // --- Rest of the function remains largely the same ---
    const userName = userNameInput.value.trim() || "User";
    const phoneNumbers = getCleanedPhoneNumbers();

    if (phoneNumbers.length === 0) {
        // ... (error handling as before) ...
         if (testSmsBtn && testSmsBtn.disabled) testSmsBtn.disabled = false;
        return;
    }

    let locationText = "an unknown location...";
    let googleMapsUrl = null;
    // ... (location text and map link generation as before) ...
    if (latitude !== null && longitude !== null) { /* ... */ } else { /* ... */ }

    const messageBody = /* ... (construct message as before) ... */ ;

    console.log(`Sending SMS data to PhilSMS Backend API: ${backendUrl}`); // Log clearly
    monitoringStatus.textContent = "Status: CRASH DETECTED! Sending alert via SMS server...";

    const payload = {
        recipients: phoneNumbers,
        message: messageBody
    };

    // Fetch call uses the specific 'backendUrl' (which is the PhilSMS URL)
    fetch(backendUrl, { /* ... method, headers, body ... */ })
    .then(response => { /* ... handle response as before ... */ })
    .then(data => { /* ... handle success as before ... */ })
    .catch(error => { /* ... handle error as before ... */ })
    .finally(() => {
        if (testSmsBtn) {
            testSmsBtn.disabled = false; // Re-enable test button after attempt
        }
    });
}

// resetCrashAlert() // No changes needed inside here

// --- Settings Persistence ---
function saveSettings() {
    const userName = userNameInput.value.trim();
    const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value; const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value; const minDecel = minDecelerationForCrashInput.value;
    // *** UPDATED: Read BOTH URLs ***
    const philsmsUrl = philsmsApiUrlInput.value.trim();
    const helmetUrl = helmetApiUrlInput.value.trim();

    // *** UPDATED: Validate ALL fields including BOTH URLs ***
    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel || !philsmsUrl || !helmetUrl) {
        settingsStatus.textContent = "Please fill in ALL setting fields, including BOTH Backend URLs.";
        settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000); return;
    }
    const phoneNumbersClean = getCleanedPhoneNumbers(phoneNumbersRaw);
    if (phoneNumbersClean.length === 0) { /* ... */ return; }
    try { new URL(philsmsUrl); new URL(helmetUrl); } catch (_) { settingsStatus.textContent = "Invalid format for one or both Backend URLs."; settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000); return; }

    // *** UPDATED: Save BOTH URLs to localStorage ***
    localStorage.setItem(STORAGE_PREFIX + 'userName', userName);
    localStorage.setItem(STORAGE_PREFIX + 'phoneNumbers', phoneNumbersRaw);
    localStorage.setItem(STORAGE_PREFIX + 'speedLimit', speedLimit);
    localStorage.setItem(STORAGE_PREFIX + 'minSpeed', minSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'maxSpeed', maxSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'minDecel', minDecel);
    localStorage.setItem(STORAGE_PREFIX + 'philsmsBackendUrl', philsmsUrl); // New key
    localStorage.setItem(STORAGE_PREFIX + 'helmetBackendUrl', helmetUrl);   // New key

    settingsStatus.textContent = "Settings saved successfully!"; settingsStatus.style.color = "green";
    console.log("Settings saved (including both Backend URLs).");
    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    userNameInput.value = localStorage.getItem(STORAGE_PREFIX + 'userName') || '';
    phoneNumbersInput.value = localStorage.getItem(STORAGE_PREFIX + 'phoneNumbers') || '';
    speedLimitInput.value = localStorage.getItem(STORAGE_PREFIX + 'speedLimit') || '60';
    minSpeedForCrashCheckInput.value = localStorage.getItem(STORAGE_PREFIX + 'minSpeed') || '30';
    maxSpeedAfterCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'maxSpeed') || '5';
    minDecelerationForCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'minDecel') || '25';
    // *** UPDATED: Load BOTH URLs from localStorage ***
    philsmsApiUrlInput.value = localStorage.getItem(STORAGE_PREFIX + 'philsmsBackendUrl') || '';
    helmetApiUrlInput.value = localStorage.getItem(STORAGE_PREFIX + 'helmetBackendUrl') || '';

    console.log("Settings loaded.");
}

// getCleanedPhoneNumbers(...) // No changes needed inside here

// --- Function to handle Test Button Click ---
function handleTestSmsClick() {
    if (testSmsBtn) testSmsBtn.disabled = true;
    console.log("Test SMS button clicked.");
    monitoringStatus.textContent = "Status: Initiating TEST SMS send...";
    monitoringStatus.style.color = "blue";

    // *** UPDATED: Read PhilSMS URL specifically for validation ***
    const philsmsUrl = philsmsApiUrlInput.value.trim();
    const phoneNumbers = getCleanedPhoneNumbers();

    // *** UPDATED: Validate required fields for testing SMS ***
    if (!philsmsUrl || !userNameInput.value || phoneNumbers.length === 0) {
        monitoringStatus.textContent = "Status: TEST FAILED (Missing required settings - PhilSMS URL, Name, or Recipients).";
        monitoringStatus.style.color = "red";
        alert("Please ensure User Name, Recipients, and PhilSMS Backend URL are set and saved before testing SMS.");
        if (testSmsBtn) testSmsBtn.disabled = false;
        return;
    }

    // --- Rest of the test function is okay, as it calls callBackendForSms which now uses the PhilSMS URL ---
    crashAlertInfo.style.display = 'block';
    crashLocationDisplay.textContent = "Fetching location for TEST...";
    smsLink.style.display = 'none';

    navigator.geolocation.getCurrentPosition(/* ... calls callBackendForSms ... */);
}


// ================== ADD THIS FUNCTION ==================
/**
 * Fetches the latest helmet impact status from the Helmet Backend Service.
 */
async function fetchHelmetStatus() {
    if (!helmetApiUrlInput || !helmetStatusDisplay) {
        console.warn("Helmet URL input or status display element not found.");
        return;
    }

    const helmetUrl = helmetApiUrlInput.value.trim();
    if (!helmetUrl) {
        // Don't show an error constantly if URL isn't set yet, just skip fetching.
        // console.log("Helmet Backend URL not set. Skipping status fetch.");
        helmetStatusDisplay.textContent = "Helmet Status: Backend URL not set";
        return;
    }

    try {
        // Construct the full URL for the endpoint
        const endpointUrl = new URL('/api/latest-impact', helmetUrl).toString(); // Handles base URL with or without trailing slash

        const response = await fetch(endpointUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // Process the response data (expecting { impactState: [bool, bool, bool, bool] })
        if (data && Array.isArray(data.impactState) && data.impactState.length === 4) {
            const [front, back, left, right] = data.impactState;
            let statusText = "Helmet Status: ";
            let impacts = [];
            if (front) impacts.push("Front");
            if (back) impacts.push("Back");
            if (left) impacts.push("Left");
            if (right) impacts.push("Right");

            if (impacts.length > 0) {
                statusText += `Impact (${impacts.join(', ')})`;
                helmetStatusDisplay.style.color = 'orange'; // Indicate impact detected
            } else {
                statusText += "No Impact Detected";
                helmetStatusDisplay.style.color = ''; // Reset color
            }
            helmetStatusDisplay.textContent = statusText;
        } else {
            console.warn("Received unexpected data format from helmet backend:", data);
            helmetStatusDisplay.textContent = "Helmet Status: Invalid data received";
            helmetStatusDisplay.style.color = 'red';
        }

    } catch (error) {
        console.error('Error fetching helmet status:', error);
        helmetStatusDisplay.textContent = `Helmet Status: Error (${error.message})`;
        helmetStatusDisplay.style.color = 'red';
    }
}
// ======================================================