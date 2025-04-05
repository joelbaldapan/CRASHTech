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
// *** Uses ID expected from HTML update for generic backend ***
const backendApiUrlInput = document.getElementById("backendApiUrl"); // UPDATED ID reference
const apiPasscodeInput = document.getElementById("apiPasscode");     // Kept ID

// Crash Alert elements
const crashAlertInfo = document.getElementById("crashAlertInfo");
const crashLocationDisplay = document.getElementById("crashLocation");
const smsLink = document.getElementById("smsLink"); // Kept for potential fallback UI
const resetCrashBtn = document.getElementById("resetCrashBtn");
const speedAlertSound = document.getElementById("speedAlertSound");

// Test Button Element ---
const testSmsBtn = document.getElementById("testSmsBtn");

// --- State Variables ---
let isMonitoring = false;
let watchId = null;
let previousSpeedKmH = 0;
let crashDetected = false;
let isSpeeding = false;

// --- Constants ---
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

// Listener for Test Button ---
if (testSmsBtn) { // Check if element exists before adding listener
    testSmsBtn.addEventListener("click", handleTestSmsClick);
} else {
    console.warn("Test SMS Button element not found in HTML.");
}

// --- Core Functions ---

function startMonitoring() {
    if (isMonitoring) return;

    // Basic Checks
    if (!("geolocation" in navigator)) { /* ... */ return; }
    // *** Use updated variable name for backend URL ***
    const backendUrl = backendApiUrlInput.value.trim();
    const apiPasscode = apiPasscodeInput.value.trim();
    // *** Update error message text ***
    if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value || !minSpeedForCrashCheckInput.value || !maxSpeedAfterCrashInput.value || !minDecelerationForCrashInput.value || !backendUrl || !apiPasscode) {
        monitoringStatus.textContent = "Error: Please fill in ALL settings fields, including Backend API URL and Passcode."; // Generic wording
        settingsStatus.textContent = "Save ALL settings before starting.";
        settingsStatus.style.color = "red";
        return;
    }
    try {
       new URL(backendUrl); // Check format using backendUrl
    } catch (_) {
       monitoringStatus.textContent = "Error: Invalid Backend API URL format."; // Generic wording
       settingsStatus.textContent = "Check Backend API URL.";
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
    let speedText = "Speed: N/A"; // Base text for main display
    let speedValueText = "N/A"; // Just the value part for the log

    if (currentSpeedMPS !== null && currentSpeedMPS >= 0) {
        currentSpeedKmH = currentSpeedMPS * 3.6;
        speedValueText = `${currentSpeedKmH.toFixed(1)} km/h`; // Store value with units
        speedText = `Speed: ${speedValueText}`; // Update main display text
    }
    display.textContent = speedText;

    // --- Speed Log Logic ---
    if (speedLog) {
        const currentTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let differenceText = "";
        if (previousSpeedKmH !== 0 && currentSpeedMPS !== null) {
             const speedDifference = currentSpeedKmH - previousSpeedKmH;
             differenceText = ` (${speedDifference >= 0 ? '+' : ''}${speedDifference.toFixed(1)} km/h)`;
        } else if (currentSpeedMPS !== null && previousSpeedKmH === 0) {
             differenceText = " (Start)";
        }

        while (speedLog.children.length >= MAX_LOG_ENTRIES) {
            speedLog.removeChild(speedLog.firstChild);
        }

        const listItem = document.createElement("li");
        listItem.textContent = `${currentTime} - ${speedValueText}${differenceText}`;
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

    // Update previousSpeedKmH for the *next* calculation, *only if* current reading was valid.
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
    smsLink.style.display = 'none';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            callBackendForSms(latitude, longitude); // Use renamed function
        },
        (error) => {
            crashLocationDisplay.textContent = `Location: Error fetching location (${error.message})`;
            console.error("Geolocation error on crash:", error);
            callBackendForSms(null, null); // Use renamed function
        },
        { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 0 }
    );
}


/**
 * *** RENAMED & UPDATED FOR GENERIC BACKEND ***
 * Calls the configured Backend API endpoint (URL read from input) to trigger SMS sending.
 * Assumes backend handles interaction with specific SMS provider (e.g., PhilSMS).
 * @param {number|null} latitude
 * @param {number|null} longitude
 */
function callBackendForSms(latitude, longitude) { // Renamed function
    // --- Read configuration from input fields ---
    // *** Use updated variable name for backend URL ***
    const backendUrl = backendApiUrlInput.value.trim();
    const apiPasscode = apiPasscodeInput.value.trim();

    // --- Validate configuration before proceeding ---
    // *** Update error message text ***
    if (!backendUrl || !apiPasscode) { // REMOVED passcode check logic from user request
        console.error("Error: Backend API URL is missing in settings."); // Adjusted error
        monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Missing Backend URL in settings)."; // Adjusted error
        crashLocationDisplay.textContent += "\nError: Cannot send alert. Backend API URL missing in settings."; // Adjusted error
        return;
    }
    try { new URL(backendUrl); } catch (_) {
       monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Invalid URL format in settings).";
       crashLocationDisplay.textContent += "\nError: Cannot send alert. Invalid Backend API URL format in settings.";
       return;
    }

    // --- Proceed with preparing data ---
    const userName = userNameInput.value.trim() || "User";
    const phoneNumbers = getCleanedPhoneNumbers(); // Get ARRAY

    if (phoneNumbers.length === 0) {
        crashLocationDisplay.textContent = (latitude !== null ? `Location: Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}` : 'Location: Unknown') +
                                           "\nError: No emergency contacts saved to notify.";
        monitoringStatus.textContent = "Status: CRASH DETECTED! No contacts to alert.";
        console.error("Cannot send SMS via Backend: No valid phone numbers saved.");
        return;
    }

    let locationText = "an unknown location (location services failed or denied)";
    if (latitude !== null && longitude !== null) {
        locationText = `location Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
        const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        crashLocationDisplay.innerHTML = `Location: ${locationText} (<a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">View Map</a>)`;
    } else {
        crashLocationDisplay.textContent = `Location: Unknown`;
    }

    const now = new Date();
    const dateOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const currentDateTime = `${now.toLocaleDateString('en-US', dateOptions)} at ${now.toLocaleTimeString('en-US', timeOptions)} (Philippine Time)`;
    const messageBody = `Automatic Crash Detection Alert from ${userName}'s phone. Potential crash detected near ${currentDateTime} at ${locationText}. Please contact emergency services or check on them immediately.`;

    // --- Call Backend API ---
    // *** Update console log and status message text ***
    console.log(`Sending data to Backend API: ${backendUrl}`);
    monitoringStatus.textContent = "Status: CRASH DETECTED! Sending alert via server..."; // Generic message

    // *** Payload sends recipients as an ARRAY, REMOVED passcode ***
    const payload = {
        recipients: phoneNumbers, // Send ARRAY
        message: messageBody
        // passcode: apiPasscode // REMOVED as per user request
    };

    fetch(backendUrl, { // Use generic backend URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
    })
    .then(response => {
        // Handle backend response
        if (!response.ok) {
            // REMOVED specific passcode check from error handling
            return response.json().then(errData => { // Assume JSON error
                 throw new Error(`Backend error ${response.status}: ${errData.error || errData.message || 'Unknown error'}`);
            }).catch(() => { // Fallback if error body isn't JSON
                throw new Error(`Backend responded with status ${response.status}: ${response.statusText}`);
            });
        }
        return response.json(); // Parse success response
    })
    .then(data => {
        // Process success data (Adapt based on your actual backend response structure)
        console.log('Backend API response:', data);
        let successes = 0; let failures = 0;
        // Example: Assuming backend returns { result: [...] }
        if (data && Array.isArray(data.result)) {
            data.result.forEach(item => {
                if (item.success) successes++;
                else { failures++; console.error(`Failed SMS to ${item.number || 'unknown'}: ${item.error || 'Unknown error'}`); }
            });
            monitoringStatus.textContent = `Status: Alert via Server complete (${successes} sent, ${failures} failed).`;
            crashLocationDisplay.textContent += `\nServer confirmation: Attempted ${successes + failures} messages. ${successes} success, ${failures} failed.`;
        }
        // Example: Handling simpler success like { success: true, message: "..." }
        else if (data && data.success) {
             monitoringStatus.textContent = `Status: Alert via Server complete.`;
             crashLocationDisplay.textContent += `\nServer confirmation: ${data.message || 'Alert request processed.'}`;
        }
         else { throw new Error('Received unexpected response format from Backend API.'); }
    })
    .catch(error => {
        // Handle fetch/network errors
        console.error('Error calling Backend API:', error);
        // *** Update error message text ***
        monitoringStatus.textContent = "Status: FAILED to send alert via server.";
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
    // *** Update to remove passcode handling ***
    const userName = userNameInput.value.trim(); const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value; const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value; const minDecel = minDecelerationForCrashInput.value;
    const backendUrl = backendApiUrlInput.value.trim(); // Use new ID
    // REMOVED: const apiPasscode = apiPasscodeInput.value.trim();

    // Update validation message
    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel || !backendUrl /* REMOVED || !apiPasscode */) {
        settingsStatus.textContent = "Please fill in ALL setting fields, including Backend API URL."; // Adjusted message
        settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000); return;
    }
    const phoneNumbersClean = getCleanedPhoneNumbers(phoneNumbersRaw);
    if (phoneNumbersClean.length === 0) { settingsStatus.textContent = "No valid PH phone numbers entered."; settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000); return; }
    try { new URL(backendUrl); } catch (_) { settingsStatus.textContent = "Invalid Backend API URL format."; settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000); return; }

    // Update localStorage saving
    localStorage.setItem(STORAGE_PREFIX + 'userName', userName);
    localStorage.setItem(STORAGE_PREFIX + 'phoneNumbers', phoneNumbersRaw);
    localStorage.setItem(STORAGE_PREFIX + 'speedLimit', speedLimit);
    localStorage.setItem(STORAGE_PREFIX + 'minSpeed', minSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'maxSpeed', maxSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'minDecel', minDecel);
    localStorage.setItem(STORAGE_PREFIX + 'backendUrl', backendUrl); // Use new key
    // REMOVED: localStorage.setItem(STORAGE_PREFIX + 'apiPasscode', apiPasscode);

    settingsStatus.textContent = "Settings saved successfully!"; settingsStatus.style.color = "green";
    console.log("Settings saved (including Backend API config)."); // Generic log
    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    // *** Update to remove passcode loading ***
    userNameInput.value = localStorage.getItem(STORAGE_PREFIX + 'userName') || '';
    phoneNumbersInput.value = localStorage.getItem(STORAGE_PREFIX + 'phoneNumbers') || '';
    speedLimitInput.value = localStorage.getItem(STORAGE_PREFIX + 'speedLimit') || '60';
    minSpeedForCrashCheckInput.value = localStorage.getItem(STORAGE_PREFIX + 'minSpeed') || '30';
    maxSpeedAfterCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'maxSpeed') || '5';
    minDecelerationForCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'minDecel') || '25';
    backendApiUrlInput.value = localStorage.getItem(STORAGE_PREFIX + 'backendUrl') || ''; // Use new key/ID
    // REMOVED: apiPasscodeInput.value = localStorage.getItem(STORAGE_PREFIX + 'apiPasscode') || '';

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

// --- Function to handle Test Button Click ---
/**
 * Handles the click event for the Test SMS button.
 * Attempts to get current location and then calls the SMS sending function.
 */
function handleTestSmsClick() {
    // *** Update validation message to remove passcode ***
    console.log("Test SMS button clicked.");
    monitoringStatus.textContent = "Status: Initiating TEST SMS send...";
    monitoringStatus.style.color = "blue";

    const backendUrl = backendApiUrlInput.value.trim(); // Use new ID
    // REMOVED: const apiPasscode = apiPasscodeInput.value.trim();
    const phoneNumbers = getCleanedPhoneNumbers();

    // Update validation message
    if (!backendUrl /* REMOVED || !apiPasscode */ || !userNameInput.value || phoneNumbers.length === 0) {
         monitoringStatus.textContent = "Status: TEST FAILED (Missing required settings - URL, Name, or Recipients)."; // Adjusted message
         monitoringStatus.style.color = "red";
         alert("Please ensure User Name, Recipients, and Backend API URL are set and saved before testing."); // Adjusted alert
         return;
    }

    crashAlertInfo.style.display = 'block';
    crashLocationDisplay.textContent = "Fetching location for TEST...";
    smsLink.style.display = 'none';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`Location fetched for test: Lat ${latitude}, Lon ${longitude}`);
            callBackendForSms(latitude, longitude); // Call generic backend function
        },
        (error) => {
            crashLocationDisplay.textContent = `Location: Error fetching location for test (${error.message})`;
            console.error("Geolocation error during test:", error);
            alert(`Could not get location for test (${error.message}). Proceeding without coordinates.`);
            callBackendForSms(null, null); // Call generic backend function
        },
        { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 0 }
    );
}
