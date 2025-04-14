// --- DOM Elements ---
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const monitoringStatus = document.getElementById("monitoringStatus");
const display = document.getElementById("display");
const speedLog = document.getElementById("speedLog");

const userNameInput = document.getElementById("userName");
const phoneNumbersInput = document.getElementById("phoneNumbers");
const speedLimitInput = document.getElementById("speedLimit");
const minSpeedForCrashCheckInput = document.getElementById("minSpeedForCrashCheck");
const maxSpeedAfterCrashInput = document.getElementById("maxSpeedAfterCrash");
const minDecelerationForCrashInput = document.getElementById("minDecelerationForCrash");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");
const backendApiUrlInput = document.getElementById("backendApiUrlInput");

const crashAlertInfo = document.getElementById("crashAlertInfo");
const crashLocationDisplay = document.getElementById("crashLocation");
const smsLink = document.getElementById("smsLink");
const resetCrashBtn = document.getElementById("resetCrashBtn");
const speedAlertSound = document.getElementById("speedAlertSound");

const testSmsBtn = document.getElementById("testSmsBtn");
const helmetStatusDisplay = document.getElementById("helmetStatusDisplay");

// --- State Variables ---
let isMonitoring = false;
let watchId = null;
let previousSpeedKmH = 0;
let crashDetected = false;
let isSpeeding = false;
let helmetStatusIntervalId = null;

// --- Constants ---
const LOCATION_TIMEOUT = 15000;
const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000
};
const MAX_LOG_ENTRIES = 100;
const STORAGE_PREFIX = 'crashDetector_';

// --- Initialization ---
loadSettings();

// --- Event Listeners ---
startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);
saveSettingsBtn.addEventListener("click", saveSettings);
resetCrashBtn.addEventListener("click", resetCrashAlert);
if (testSmsBtn) {
    testSmsBtn.addEventListener("click", handleTestSmsClick);
}

// --- Core Functions ---

function startMonitoring() {
    if (isMonitoring) return;

    if (!("geolocation" in navigator)) {
        monitoringStatus.textContent = "Error: Geolocation not supported.";
        return;
    }
    // Read the single base URL
    const backendUrl = backendApiUrlInput.value.trim();

    // Validate ALL settings including the single backend URL
    if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value || !minSpeedForCrashCheckInput.value || !maxSpeedAfterCrashInput.value || !minDecelerationForCrashInput.value || !backendUrl ) {
        monitoringStatus.textContent = "Error: Please fill in ALL settings fields, including the Backend URL.";
        settingsStatus.textContent = "Save ALL settings before starting.";
        settingsStatus.style.color = "red";
        return;
    }
    try {
        new URL(backendUrl); // Check base URL format
    } catch (_) {
        monitoringStatus.textContent = "Error: Invalid format for Backend API URL.";
        settingsStatus.textContent = "Check Backend API URL.";
        settingsStatus.style.color = "red";
        return;
    }

    // Reset state and UI
    monitoringStatus.textContent = "Status: Starting...";
    monitoringStatus.style.color = "";
    if (helmetStatusDisplay) helmetStatusDisplay.textContent = "Helmet Status: Initializing...";
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

        // Start polling helmet status using the single backend URL
        fetchHelmetStatus(); // Fetch immediately
        helmetStatusIntervalId = setInterval(fetchHelmetStatus, 3000); // Poll every 3 seconds

    } else {
        monitoringStatus.textContent = "Error: Geolocation is not available.";
    }
}

function stopMonitoring() {
    if (!isMonitoring || watchId === null) return;
    navigator.geolocation.clearWatch(watchId);

    // Stop polling helmet status
    if (helmetStatusIntervalId) {
        clearInterval(helmetStatusIntervalId);
        helmetStatusIntervalId = null;
    }
    if (helmetStatusDisplay) helmetStatusDisplay.textContent = "Helmet Status: Off";

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

    const { latitude, longitude, speed: currentSpeedMPS } = position.coords;
    const timestamp = position.timestamp;
    let currentSpeedKmH = 0;
    let speedText = "Speed: N/A";
    let speedValueText = "N/A";

    if (currentSpeedMPS !== null && currentSpeedMPS >= 0) {
        currentSpeedKmH = currentSpeedMPS * 3.6;
        speedValueText = `${currentSpeedKmH.toFixed(1)} km/h`;
        speedText = `Speed: ${speedValueText}`;
    }

    if (latitude !== null && longitude !== null) {
        speedText += ` (Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)})`;
    }
    display.textContent = speedText;

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
        speedLog.scrollTop = speedLog.scrollHeight;
    }

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
            callBackendForSms(latitude, longitude);
        },
        (error) => {
            crashLocationDisplay.textContent = `Location: Error fetching location (${error.message})`;
            console.error("Geolocation error on crash:", error);
            callBackendForSms(null, null);
        },
        { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 0 }
    );
}

function callBackendForSms(latitude, longitude) {
    // Read the single BASE backend URL
    const baseBackendUrl = backendApiUrlInput.value.trim();

    if (!baseBackendUrl) {
        console.error("Error: Backend API URL is missing in settings.");
        monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Missing Backend URL).";
        crashLocationDisplay.textContent += "\nError: Cannot send alert. Backend URL missing.";
        if (testSmsBtn && testSmsBtn.disabled) testSmsBtn.disabled = false;
        return;
    }
    let smsEndpointUrl;
    try {
        // Construct the full URL for the SMS endpoint
        smsEndpointUrl = new URL('/api/send-philsms', baseBackendUrl).toString();
    } catch (_) {
        monitoringStatus.textContent = "Status: CRASH DETECTED! FAILED (Invalid URL format).";
        crashLocationDisplay.textContent += "\nError: Cannot send alert. Invalid Backend URL format.";
        if (testSmsBtn && testSmsBtn.disabled) testSmsBtn.disabled = false;
        return;
    }

    const userName = userNameInput.value.trim() || "User";
    const phoneNumbers = getCleanedPhoneNumbers();

    if (phoneNumbers.length === 0) {
        crashLocationDisplay.textContent = (latitude !== null ? `Location: Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}` : 'Location: Unknown') +
                                            "\nError: No emergency contacts saved to notify.";
        monitoringStatus.textContent = "Status: CRASH DETECTED! No contacts to alert.";
        console.error("Cannot send SMS via Backend: No valid phone numbers saved.");
        if (testSmsBtn && testSmsBtn.disabled) testSmsBtn.disabled = false;
        return;
    }

    let locationText = "an unknown location (location services failed or denied)";
    let googleMapsUrl = null;

    if (latitude !== null && longitude !== null) {
        locationText = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
        googleMapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`; // Standard Google Maps URL
        crashLocationDisplay.innerHTML = `Location: ${locationText} (<a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer">View Map</a>)`;
    } else {
        crashLocationDisplay.textContent = `Location: Unknown`;
    }

    // Construct Message Body
    const now = new Date();
    const dateOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const currentDateTime = `${now.toLocaleDateString('en-US', dateOptions)} at ${now.toLocaleTimeString('en-US', timeOptions)} (Philippine Time)`;
    let messageBody = `-- ALERT: Automatic Crash Detection Alert from ${userName}'s phone. Potential crash detected! ${currentDateTime} at ${locationText}. Please contact emergency services or check on them immediately. --`;
    if (googleMapsUrl) {
        messageBody += `\n-x- LOCATION: ${googleMapsUrl} -x-`; // Append the link on a new line
    }
    // End Message Body Construction


    console.log(`Sending SMS data to Backend API: ${smsEndpointUrl}`);
    monitoringStatus.textContent = "Status: CRASH DETECTED! Sending alert via server...";

    const payload = {
        recipients: phoneNumbers, // Send ARRAY
        message: messageBody
    };

    // Call Backend API
    fetch(smsEndpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
    })
    .then(response => {
        // Parse JSON first, then check response.ok
        return response.json().then(data => { // Always try parsing JSON
            if (!response.ok) {
                let backendErrorMessage = 'Unknown backend error'; // Default message
                if (data && data.result && Array.isArray(data.result) && data.result.length > 0 && data.result[0].error) {
                    backendErrorMessage = data.result[0].error;
                }
                else if (data && data.error) {
                    backendErrorMessage = data.error;
                }
                else if (data && data.message) {
                    backendErrorMessage = data.message;
                }
                throw new Error(`${backendErrorMessage}`); // Simplified error message for display
            }
            return data; // If response was ok, return the parsed success data
        }).catch(parseOrLogicError => {
            // Handle cases where parsing failed OR the logic above threw an error message
            if (parseOrLogicError instanceof Error && (parseOrLogicError.message.includes('Backend error') || parseOrLogicError.message.includes('PhilSMS Error') || parseOrLogicError.message.includes('validation error'))) {
                 throw parseOrLogicError; // Re-throw errors identified by backend response structure
            }
            // Handle cases where response wasn't JSON or other unexpected parsing issues
            console.error("Failed to parse backend response or logic error:", parseOrLogicError);
            throw new Error(`Backend responded with status ${response.status} but failed to parse response or process error structure.`);
        });
    })
    .then(data => {
        // Process success data
        console.log('Backend API response:', data);
        let successes = 0; let failures = 0;
        if (data && Array.isArray(data.result)) {
             data.result.forEach(item => {
                 if (item.success) successes++;
                 else { failures++; console.error(`Failed SMS to ${item.number || 'unknown'}: ${item.error || 'Unknown error'}`); }
             });
             monitoringStatus.textContent = `Status: Alert via Server complete (${successes} sent, ${failures} failed).`;
             const successText = `\nServer confirmation: Attempted ${successes + failures} messages. ${successes} success, ${failures} failed.`;
             crashLocationDisplay.appendChild(document.createTextNode(successText));
        }
        else if (data && data.status === 'success') {
             // Handle single success response if backend structure changes
             monitoringStatus.textContent = `Status: Alert via Server complete.`;
             const successText = `\nServer confirmation: ${data.message || 'Alert request processed.'}`;
             crashLocationDisplay.appendChild(document.createTextNode(successText));
        }
         else {
             // Handle unexpected success formats
             console.warn('Received unexpected success response format from Backend API:', data);
             throw new Error('Received unexpected success response format from Backend API.');
         }
    })
    .catch(error => {
        // Handle fetch/network errors or errors thrown from the logic above
        console.error('Error calling Backend API:', error);
        monitoringStatus.textContent = `Status: FAILED to send alert via server (${error.message}).`;
        monitoringStatus.style.color = "red";
        const errorText = `\nError: Could not send automatic alert (${error.message}). Notify contacts manually if possible.`;
        crashLocationDisplay.appendChild(document.createTextNode(errorText));
    })
    .finally(() => {
        // Re-enable test button after attempt, regardless of outcome
        if (testSmsBtn) {
            testSmsBtn.disabled = false;
        }
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
    if (testSmsBtn) {
        testSmsBtn.disabled = false;
    }
}

// --- Settings Persistence ---
function saveSettings() {
    const userName = userNameInput.value.trim();
    const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value; const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value; const minDecel = minDecelerationForCrashInput.value;
    // Read the single base URL
    const backendUrl = backendApiUrlInput.value.trim();

    // Validate ALL fields including the single base URL
    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel || !backendUrl) {
        settingsStatus.textContent = "Please fill in ALL setting fields, including the Backend URL.";
        settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000); return;
    }
    const phoneNumbersClean = getCleanedPhoneNumbers(phoneNumbersRaw);
    if (phoneNumbersClean.length === 0) {
        settingsStatus.textContent = "No valid PH phone numbers entered."; settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
        return;
    }
    try { new URL(backendUrl); } catch (_) {
        settingsStatus.textContent = "Invalid Backend API URL format."; settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
        return;
    }

    // Save the single base URL
    localStorage.setItem(STORAGE_PREFIX + 'userName', userName);
    localStorage.setItem(STORAGE_PREFIX + 'phoneNumbers', phoneNumbersRaw);
    localStorage.setItem(STORAGE_PREFIX + 'speedLimit', speedLimit);
    localStorage.setItem(STORAGE_PREFIX + 'minSpeed', minSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'maxSpeed', maxSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'minDecel', minDecel);
    localStorage.setItem(STORAGE_PREFIX + 'backendUrl', backendUrl); // Use single key

    settingsStatus.textContent = "Settings saved successfully!"; settingsStatus.style.color = "green";
    console.log("Settings saved (including single Backend URL).");
    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    userNameInput.value = localStorage.getItem(STORAGE_PREFIX + 'userName') || '';
    phoneNumbersInput.value = localStorage.getItem(STORAGE_PREFIX + 'phoneNumbers') || '';
    speedLimitInput.value = localStorage.getItem(STORAGE_PREFIX + 'speedLimit') || '60';
    minSpeedForCrashCheckInput.value = localStorage.getItem(STORAGE_PREFIX + 'minSpeed') || '30';
    maxSpeedAfterCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'maxSpeed') || '5';
    minDecelerationForCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'minDecel') || '25';
    // Load the single base URL
    backendApiUrlInput.value = localStorage.getItem(STORAGE_PREFIX + 'backendUrl') || ''; // Use single key

    console.log("Settings loaded.");
}

// --- Utility Functions ---
function getCleanedPhoneNumbers(rawString = null) {
    const inputString = rawString === null ? phoneNumbersInput.value : rawString;
    const phRegex = /^(09\d{9}|\+639\d{9})$/; // Regex for PH numbers starting with 09 or +639
    return inputString
        .split(',') // Split by comma
        .map(num => num.trim()) // Remove whitespace around each number
        .filter(num => phRegex.test(num)); // Keep only numbers matching the regex
}

// --- Function to handle Test Button Click ---
function handleTestSmsClick() {
    if (testSmsBtn) testSmsBtn.disabled = true;
    console.log("Test SMS button clicked.");
    monitoringStatus.textContent = "Status: Initiating TEST SMS send...";
    monitoringStatus.style.color = "blue";

    // Read the single base URL for validation
    const backendUrl = backendApiUrlInput.value.trim();
    const phoneNumbers = getCleanedPhoneNumbers();

    if (!backendUrl || !userNameInput.value || phoneNumbers.length === 0) {
        monitoringStatus.textContent = "Status: TEST FAILED (Missing required settings - Backend URL, Name, or Recipients).";
        monitoringStatus.style.color = "red";
        alert("Please ensure User Name, Recipients, and Backend URL are set and saved before testing SMS.");
        if (testSmsBtn) testSmsBtn.disabled = false;
        return;
    }

    // Rest of the function calls callBackendForSms, which now constructs the correct URL
    crashAlertInfo.style.display = 'block';
    crashLocationDisplay.textContent = "Fetching location for TEST...";
    smsLink.style.display = 'none';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`Location fetched for test: Lat ${latitude}, Lon ${longitude}`);
            callBackendForSms(latitude, longitude); // Calls the function that uses the single base URL
        },
        (error) => {
            crashLocationDisplay.textContent = `Location: Error fetching location for test (${error.message})`;
            console.error("Geolocation error during test:", error);
            alert(`Could not get location for test (${error.message}). Proceeding without coordinates.`);
            callBackendForSms(null, null); // Still calls the function, but without coordinates
        },
        { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 0 } // Options object
    );
}


// --- Function to fetch Helmet Status (Uses single base URL) ---
async function fetchHelmetStatus() {
    if (!backendApiUrlInput || !helmetStatusDisplay) {
        // console.warn("Helmet URL input or status display element not found.");
        return; // Silently return if elements aren't found
    }

    // Read the single base URL
    const baseBackendUrl = backendApiUrlInput.value.trim();
    if (!baseBackendUrl) {
        // Only update status if it's not already showing this message
        if (helmetStatusDisplay.textContent !== "Helmet Status: Backend URL not set") {
             helmetStatusDisplay.textContent = "Helmet Status: Backend URL not set";
             helmetStatusDisplay.style.color = 'grey'; // Use a neutral color
        }
        return; // Don't try fetching if URL is missing
    }

    try {
        // Construct the full URL for the helmet status endpoint
        const endpointUrl = new URL('/api/latest-impact', baseBackendUrl).toString();
        const response = await fetch(endpointUrl);

        if (!response.ok) {
            // Provide more specific feedback for common HTTP errors
            let errorMsg = `HTTP error! Status: ${response.status}`;
            if (response.status === 404) errorMsg = "Error: Helmet API endpoint not found (404)";
            else if (response.status === 500) errorMsg = "Error: Helmet server error (500)";
            throw new Error(errorMsg);
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
                helmetStatusDisplay.style.color = ''; // Reset color to default
            }
            helmetStatusDisplay.textContent = statusText;
        } else {
            // Handle unexpected data format
            console.warn("Received unexpected data format from helmet backend:", data);
            helmetStatusDisplay.textContent = "Helmet Status: Invalid data received";
            helmetStatusDisplay.style.color = 'red';
        }

    } catch (error) {
        // Handle fetch errors (network issues, CORS, etc.)
        console.error('Error fetching helmet status:', error);
        let displayError = error.message;
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             displayError = 'Network Error fetching helmet status';
        }
        helmetStatusDisplay.textContent = `Helmet Status: Error (${displayError})`;
        helmetStatusDisplay.style.color = 'red'; // Use red for errors
    }
}