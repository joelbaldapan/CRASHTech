// main.js - Complete Frontend Code using Twilio Function for SMS
// Configured via UI inputs instead of hardcoded constants

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

// Inputs for Twilio config
const twilioFunctionUrlInput = document.getElementById("twilioFunctionUrl");
const apiPasscodeInput = document.getElementById("apiPasscode");


// Crash Alert elements
const crashAlertInfo = document.getElementById("crashAlertInfo");
const crashLocationDisplay = document.getElementById("crashLocation");
const smsLink = document.getElementById("smsLink"); // Kept for potential fallback UI
const resetCrashBtn = document.getElementById("resetCrashBtn");
const speedAlertSound = document.getElementById("speedAlertSound");

// --- State Variables ---
let isMonitoring = false;
let watchId = null;
let previousSpeedKmH = 0;
let crashDetected = false;
let isSpeeding = false;

// --- Constants ---
// REMOVED hardcoded URL and Passcode constants
const LOCATION_TIMEOUT = 15000;
const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000
};
const MAX_LOG_ENTRIES = 100;
const STORAGE_PREFIX = 'crashDetector_'; // Prefix for localStorage keys

// --- Initialization ---
loadSettings(); // Load saved settings on page load

// --- Event Listeners ---
startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);
saveSettingsBtn.addEventListener("click", saveSettings);
resetCrashBtn.addEventListener("click", resetCrashAlert);

// --- Core Functions ---

function startMonitoring() {
    if (isMonitoring) return;

    // Basic Checks
    if (!("geolocation" in navigator)) { /* ... */ return; }
    // Check if essential settings AND Twilio config have values
    const functionUrl = twilioFunctionUrlInput.value.trim();
    const apiPasscode = apiPasscodeInput.value.trim(); // Get passcode trim only, might be sensitive to spaces?
    if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value || !minSpeedForCrashCheckInput.value || !maxSpeedAfterCrashInput.value || !minDecelerationForCrashInput.value || !functionUrl || !apiPasscode) {
        monitoringStatus.textContent = "Error: Please fill in ALL settings fields, including Twilio URL and Passcode.";
        settingsStatus.textContent = "Save ALL settings before starting.";
        settingsStatus.style.color = "red";
        // Optionally focus the first empty required field
        return;
    }
    // Basic URL format check (optional but helpful)
    try {
       new URL(functionUrl);
    } catch (_) {
       monitoringStatus.textContent = "Error: Invalid Twilio Function URL format.";
       settingsStatus.textContent = "Check Twilio Function URL.";
       settingsStatus.style.color = "red";
       return;
    }


    // Reset state and UI
    monitoringStatus.textContent = "Status: Starting...";
    monitoringStatus.style.color = "";
    crashDetected = false;
    isSpeeding = false;
    display.style.color = '';
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;
    if (speedLog) speedLog.innerHTML = "";

    // Start Geolocation Watch
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            handlePositionUpdate,
            handleGeolocationError,
            GEOLOCATION_OPTIONS
        );
        isMonitoring = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        monitoringStatus.textContent = "Status: Monitoring speed...";
        console.log("Monitoring started with watchId:", watchId);
    } else {
        monitoringStatus.textContent = "Error: Geolocation is not available.";
    }
}

function stopMonitoring() {
    if (!isMonitoring || watchId === null) return;
    navigator.geolocation.clearWatch(watchId);
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

function handlePositionUpdate(position) {
    if (!isMonitoring) return;

    const currentSpeedMPS = position.coords.speed;
    const timestamp = position.timestamp;
    let currentSpeedKmH = 0;
    let speedText = "Speed: N/A";

    if (currentSpeedMPS !== null && currentSpeedMPS >= 0) {
        currentSpeedKmH = currentSpeedMPS * 3.6;
        speedText = `Speed: ${currentSpeedKmH.toFixed(1)} km/h`;
    }
    display.textContent = speedText;

    // --- Speed Log Logic ---
    if (speedLog) {
        const currentTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        while (speedLog.children.length >= MAX_LOG_ENTRIES) {
            speedLog.removeChild(speedLog.firstChild);
        }
        const listItem = document.createElement("li");
        listItem.textContent = `${currentTime} - ${speedText}`;
        speedLog.appendChild(listItem);
    }
    // --- End Speed Log Logic ---

    // --- Speed Limit Alert Logic ---
    if (!crashDetected) {
        const speedLimit = parseFloat(speedLimitInput.value);
        if (!isNaN(speedLimit) && speedAlertSound && currentSpeedKmH > 0) {
             if (currentSpeedKmH > speedLimit && !isSpeeding) {
                isSpeeding = true;
                display.style.color = 'orange';
                speedAlertSound.play().catch(e => console.error("Audio play failed:", e));
                console.log(`Speed limit (${speedLimit} km/h) exceeded.`);
            } else if (currentSpeedKmH <= speedLimit && isSpeeding) {
                isSpeeding = false;
                display.style.color = '';
                console.log(`Speed back below limit (${speedLimit} km/h).`);
            }
        } else if (isSpeeding) {
            isSpeeding = false;
            display.style.color = '';
        }
    }
    // --- End Speed Limit Alert Logic ---

    // --- Crash Detection Logic ---
    if (!crashDetected) {
        const minSpeedBefore = parseFloat(minSpeedForCrashCheckInput.value);
        const maxSpeedAfter = parseFloat(maxSpeedAfterCrashInput.value);
        const minDeceleration = parseFloat(minDecelerationForCrashInput.value);
        const actualDeceleration = previousSpeedKmH - currentSpeedKmH;
        if ( previousSpeedKmH > minSpeedBefore &&
             currentSpeedKmH < maxSpeedAfter &&
             actualDeceleration >= minDeceleration &&
             currentSpeedMPS !== null )
        {
            console.log(`CRASH DETECTED (Sudden Stop): Speed drop ${previousSpeedKmH.toFixed(1)} -> ${currentSpeedKmH.toFixed(1)}`);
            display.style.color = 'red';
            triggerCrashAlert();
        }
    }
    // --- End Crash Detection Logic ---

    if (currentSpeedMPS !== null) {
       previousSpeedKmH = currentSpeedKmH;
    }
}

function handleGeolocationError(error) {
    monitoringStatus.textContent = `Status: Geolocation Error (${error.code}: ${error.message})`;
    display.textContent = "Speed: Error";
    display.style.color = '';
    isSpeeding = false;
    console.error("Geolocation Error:", error);
    if (error.code === 1) {
        stopMonitoring();
        monitoringStatus.textContent = "Status: Geolocation Permission Denied. Monitoring stopped.";
    }
}

function triggerCrashAlert() {
    if (crashDetected) return;
    crashDetected = true;
    isSpeeding = false;
    display.style.color = 'red';
    monitoringStatus.textContent = "Status: CRASH DETECTED! Processing alert...";
    monitoringStatus.style.color = "red";

    crashAlertInfo.style.display = 'block';
    crashLocationDisplay.textContent = "Fetching location for alert...";
    smsLink.style.display = 'none'; // Hide manual link

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            callTwilioFunctionForSms(latitude, longitude); // Call the function that calls the API
        },
        (error) => {
            crashLocationDisplay.textContent = `Location: Error fetching location (${error.message})`;
            console.error("Geolocation error on crash:", error);
            callTwilioFunctionForSms(null, null); // Call API even if location failed
        },
        { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 0 }
    );
}


/**
 * Calls the Twilio Function endpoint (URL read from input) to send SMS.
 * @param {number|null} latitude
 * @param {number|null} longitude
 */
function callTwilioFunctionForSms(latitude, longitude) {
    // --- Read configuration from input fields ---
    const functionUrl = twilioFunctionUrlInput.value.trim();
    const apiPasscode = apiPasscodeInput.value.trim(); // Read passcode trim only

    // --- Validate configuration before proceeding ---
    if (!functionUrl || !apiPasscode) {
        console.error("Error: Twilio Function URL or API Passcode is missing in settings.");
        monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Missing URL/Passcode in settings).";
        crashLocationDisplay.textContent += "\nError: Cannot send alert. Twilio URL or Passcode missing in settings.";
        return; // Stop if config is missing
    }
    try { new URL(functionUrl); } catch (_) {
       monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Invalid URL format in settings).";
       crashLocationDisplay.textContent += "\nError: Cannot send alert. Invalid Twilio Function URL format in settings.";
       return;
    }

    // --- Proceed with preparing data ---
    const userName = userNameInput.value.trim() || "User";
    const phoneNumbers = getCleanedPhoneNumbers();

    if (phoneNumbers.length === 0) {
        crashLocationDisplay.textContent = (latitude !== null ? `Location: Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}` : 'Location: Unknown') +
                                           "\nError: No emergency contacts saved to notify.";
        monitoringStatus.textContent = "Status: CRASH DETECTED! No contacts to alert.";
        console.error("Cannot send SMS via Twilio Function: No valid phone numbers saved.");
        return;
    }

    // Update location display
    let locationText = "an unknown location (location services failed or denied)";
    if (latitude !== null && longitude !== null) {
        locationText = `location Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
        const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        crashLocationDisplay.innerHTML = `Location: ${locationText} (<a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">View Map</a>)`;
    } else {
         crashLocationDisplay.textContent = `Location: Unknown`;
    }

    // Construct message body
    const now = new Date();
    const dateOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const currentDateTime = `${now.toLocaleDateString('en-US', dateOptions)} at ${now.toLocaleTimeString('en-US', timeOptions)} (Philippine Time)`;
    const messageBody = `Automatic Crash Detection Alert from ${userName}'s phone. Potential crash detected near ${currentDateTime} at ${locationText}. Please contact emergency services or check on them immediately.`;

    // --- Call Twilio Function ---
    console.log(`Sending data to Twilio Function: ${functionUrl}`);
    monitoringStatus.textContent = "Status: CRASH DETECTED! Sending alert via Twilio...";

    const payload = {
        recipients: phoneNumbers.join(','), // Send as comma-separated STRING
        message: messageBody,
        passcode: apiPasscode               // Send the passcode read from input
    };

    fetch(functionUrl, { // Use URL from input
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                // Check specifically for passcode error text if function sends it that way
                if (response.status === 401 || (text && text.toLowerCase().includes('invalid passcode'))) {
                     throw new Error(`Authentication failed: Invalid Passcode provided.`);
                }
                throw new Error(`Twilio Function error ${response.status}: ${text || response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Twilio Function response:', data);
        let successes = 0;
        let failures = 0;
        if (data && Array.isArray(data.result)) {
            data.result.forEach(item => {
                if (item.success) successes++;
                else {
                    failures++;
                    console.error(`Failed SMS to ${item.number}: ${item.error}`);
                }
            });
            monitoringStatus.textContent = `Status: CRASH DETECTED! Alert via Twilio complete (${successes} sent, ${failures} failed).`;
            crashLocationDisplay.textContent += `\nTwilio confirmation: Attempted ${successes + failures} messages. ${successes} success, ${failures} failed.`;
        } else {
             throw new Error('Received unexpected response format from Twilio Function.');
        }
    })
    .catch(error => {
        console.error('Error calling Twilio Function:', error);
        monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED to send alert via Twilio.";
        monitoringStatus.style.color = "red";
        crashLocationDisplay.textContent += `\nError: Could not send automatic alert (${error.message}). Notify contacts manually if possible.`;
    });
}


function resetCrashAlert() {
    crashDetected = false;
    crashAlertInfo.style.display = 'none';
    monitoringStatus.textContent = isMonitoring ? "Status: Monitoring speed..." : "Status: Idle";
    monitoringStatus.style.color = "";
    display.style.color = '';
    isSpeeding = false;
    previousSpeedKmH = 0;
    console.log("Crash alert reset.");
    if (!isMonitoring && watchId === null) {
       stopBtn.disabled = true;
       startBtn.disabled = false;
    } else if (isMonitoring) {
        monitoringStatus.textContent = "Status: Monitoring speed...";
    }
}

// --- Settings Persistence ---
function saveSettings() {
    // Get all values from inputs, including new ones
    const userName = userNameInput.value.trim();
    const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value;
    const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value;
    const minDecel = minDecelerationForCrashInput.value;
    const functionUrl = twilioFunctionUrlInput.value.trim();
    const apiPasscode = apiPasscodeInput.value.trim(); // Trim only for passcode

    // Validation (ensure all fields are filled)
    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel || !functionUrl || !apiPasscode) {
        settingsStatus.textContent = "Please fill in ALL setting fields.";
        settingsStatus.style.color = "red";
        setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
        return;
    }
    const phoneNumbersClean = getCleanedPhoneNumbers(phoneNumbersRaw);
     if (phoneNumbersClean.length === 0) {
        settingsStatus.textContent = "No valid PH phone numbers entered.";
        settingsStatus.style.color = "red";
        setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
        return;
    }
     try { new URL(functionUrl); } catch (_) {
       settingsStatus.textContent = "Invalid Twilio Function URL format.";
       settingsStatus.style.color = "red";
       setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
        return;
    }

    // Save all values to localStorage using prefixed keys
    localStorage.setItem(STORAGE_PREFIX + 'userName', userName);
    localStorage.setItem(STORAGE_PREFIX + 'phoneNumbers', phoneNumbersRaw);
    localStorage.setItem(STORAGE_PREFIX + 'speedLimit', speedLimit);
    localStorage.setItem(STORAGE_PREFIX + 'minSpeed', minSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'maxSpeed', maxSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'minDecel', minDecel);
    localStorage.setItem(STORAGE_PREFIX + 'functionUrl', functionUrl); // Save URL
    localStorage.setItem(STORAGE_PREFIX + 'apiPasscode', apiPasscode); // Save Passcode

    settingsStatus.textContent = "Settings saved successfully!";
    settingsStatus.style.color = "green";
    console.log("Settings saved (including Twilio config).");
    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    // Load all values from localStorage using prefixed keys
    userNameInput.value = localStorage.getItem(STORAGE_PREFIX + 'userName') || '';
    phoneNumbersInput.value = localStorage.getItem(STORAGE_PREFIX + 'phoneNumbers') || '';
    speedLimitInput.value = localStorage.getItem(STORAGE_PREFIX + 'speedLimit') || '60'; // Default value
    minSpeedForCrashCheckInput.value = localStorage.getItem(STORAGE_PREFIX + 'minSpeed') || '30'; // Default value
    maxSpeedAfterCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'maxSpeed') || '5'; // Default value
    minDecelerationForCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'minDecel') || '25'; // Default value
    twilioFunctionUrlInput.value = localStorage.getItem(STORAGE_PREFIX + 'functionUrl') || ''; // Load URL
    apiPasscodeInput.value = localStorage.getItem(STORAGE_PREFIX + 'apiPasscode') || ''; // Load Passcode

    console.log("Settings loaded.");
}

// --- Utility Functions ---
function getCleanedPhoneNumbers(rawString = null) {
     const inputString = rawString === null ? phoneNumbersInput.value : rawString;
    const phRegex = /^(09\d{9}|\+639\d{9})$/;
    return inputString
        .split(',')
        .map(num => num.trim())
        .filter(num => phRegex.test(num));
}