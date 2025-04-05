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
const backendApiUrlInput = document.getElementById("backendApiUrl");

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
    const backendUrl = backendApiUrlInput.value.trim();

    if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value || !minSpeedForCrashCheckInput.value || !maxSpeedAfterCrashInput.value || !minDecelerationForCrashInput.value || !backendUrl /* REMOVED || !apiPasscode */ ) {
        monitoringStatus.textContent = "Error: Please fill in ALL settings fields, including Backend API URL."; // Adjusted message
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
    const backendUrl = backendApiUrlInput.value.trim();

    // --- Validate configuration before proceeding ---
    if (!backendUrl) {
        console.error("Error: Backend API URL is missing in settings.");
        monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Missing Backend URL in settings).";
        crashLocationDisplay.textContent += "\nError: Cannot send alert. Backend API URL missing in settings.";
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
    console.log(`Sending data to Backend API: ${backendUrl}`);
    monitoringStatus.textContent = "Status: CRASH DETECTED! Sending alert via server..."; // Generic message

    const payload = {
        recipients: phoneNumbers, // Send ARRAY
        message: messageBody
    };

    fetch(backendUrl, { // Use generic backend URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
    })
    .then(response => {
        // *** Parse JSON first, then check response.ok ***
        // This makes extracting the error message from the body more reliable
        return response.json().then(data => { // Always try parsing JSON
            if (!response.ok) {
                // Now 'data' holds the parsed error JSON (or would have failed in .catch below)
                let backendErrorMessage = 'Unknown backend error'; // Default message
                // Check for the specific nested error structure from PhilSMS via backend
                if (data && data.result && Array.isArray(data.result) && data.result.length > 0 && data.result[0].error) {
                    backendErrorMessage = data.result[0].error;
                }
                // Check for the backend's own validation error structure
                else if (data && data.error) {
                    backendErrorMessage = data.error;
                }
                // Fallback if backend uses a top-level 'message' field for errors
                else if (data && data.message) {
                    backendErrorMessage = data.message;
                }
                // Throw an error with the specific message extracted
                throw new Error(`${backendErrorMessage}`); // Simplified error message for display
            }
            // If response was ok, return the parsed success data
            return data;
        // Handle cases where the response body wasn't valid JSON *at all*
        }).catch(parseOrLogicError => {
            // If the error is because we threw it above, re-throw it for the final catch
            if (parseOrLogicError instanceof Error && parseOrLogicError.message.startsWith('Backend error') || parseOrLogicError.message.includes('PhilSMS Error') || parseOrLogicError.message.includes('validation error')) {
                 throw parseOrLogicError;
            }
            // Otherwise, it was likely a JSON parsing error
            console.error("Failed to parse backend response or logic error:", parseOrLogicError);
            // Throw a new error indicating a non-JSON response or unexpected structure
            throw new Error(`Backend responded with status ${response.status} but failed to parse response or process error structure.`);
        });
    })
    .then(data => {
        // Process success data (Adapt based on your actual backend response structure)
        console.log('Backend API response:', data);
        let successes = 0; let failures = 0;
        // Check the structure your backend sends on success
        if (data && Array.isArray(data.result)) {
             data.result.forEach(item => {
                 if (item.success) successes++;
                 else { failures++; console.error(`Failed SMS to ${item.number || 'unknown'}: ${item.error || 'Unknown error'}`); }
             });
             monitoringStatus.textContent = `Status: Alert via Server complete (${successes} sent, ${failures} failed).`;
             // Append success info without overwriting map link
             const successText = `\nServer confirmation: Attempted ${successes + failures} messages. ${successes} success, ${failures} failed.`;
             crashLocationDisplay.appendChild(document.createTextNode(successText));
        }
        // Handle other potential success structures if your backend varies
        else if (data && data.status === 'success') { // e.g., if backend directly mirrors PhilSMS success
              monitoringStatus.textContent = `Status: Alert via Server complete.`;
              const successText = `\nServer confirmation: ${data.message || 'Alert request processed.'}`;
              crashLocationDisplay.appendChild(document.createTextNode(successText));
        }
         else {
             // Handle unexpected success format
             console.warn('Received unexpected success response format from Backend API:', data);
             throw new Error('Received unexpected success response format from Backend API.');
         }
    })
    .catch(error => {
        // This catch block now receives the error thrown from the logic above or network errors
        console.error('Error calling Backend API:', error);
        // Display the specific error message extracted previously
        monitoringStatus.textContent = `Status: FAILED to send alert via server (${error.message}).`;
        monitoringStatus.style.color = "red";
        // Append error text node to crashLocationDisplay to preserve potential map link
        const errorText = `\nError: Could not send automatic alert (${error.message}). Notify contacts manually if possible.`;
        crashLocationDisplay.appendChild(document.createTextNode(errorText));
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
    const userName = userNameInput.value.trim(); const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value; const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value; const minDecel = minDecelerationForCrashInput.value;
    const backendUrl = backendApiUrlInput.value.trim(); // Use new ID

    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel || !backendUrl
        settingsStatus.textContent = "Please fill in ALL setting fields, including Backend API URL.";
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
    localStorage.setItem(STORAGE_PREFIX + 'backendUrl', backendUrl);

    settingsStatus.textContent = "Settings saved successfully!"; settingsStatus.style.color = "green";
    console.log("Settings saved (including Backend API config).");
    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    userNameInput.value = localStorage.getItem(STORAGE_PREFIX + 'userName') || '';
    phoneNumbersInput.value = localStorage.getItem(STORAGE_PREFIX + 'phoneNumbers') || '';
    speedLimitInput.value = localStorage.getItem(STORAGE_PREFIX + 'speedLimit') || '60';
    minSpeedForCrashCheckInput.value = localStorage.getItem(STORAGE_PREFIX + 'minSpeed') || '30';
    maxSpeedAfterCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'maxSpeed') || '5';
    minDecelerationForCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'minDecel') || '25';
    backendApiUrlInput.value = localStorage.getItem(STORAGE_PREFIX + 'backendUrl') || '';

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
    console.log("Test SMS button clicked.");
    monitoringStatus.textContent = "Status: Initiating TEST SMS send...";
    monitoringStatus.style.color = "blue";

    const backendUrl = backendApiUrlInput.value.trim();
    const phoneNumbers = getCleanedPhoneNumbers();

    // Update validation message
    if (!backendUrl /* REMOVED || !apiPasscode */ || !userNameInput.value || phoneNumbers.length === 0) {
         monitoringStatus.textContent = "Status: TEST FAILED (Missing required settings - URL, Name, or Recipients).";
         monitoringStatus.style.color = "red";
         alert("Please ensure User Name, Recipients, and Backend API URL are set and saved before testing.");
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