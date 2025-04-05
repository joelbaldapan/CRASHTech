// --- DOM Elements ---
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const monitoringStatus = document.getElementById("monitoringStatus");
const display = document.getElementById("display");

// Settings elements
const userNameInput = document.getElementById("userName");
const phoneNumbersInput = document.getElementById("phoneNumbers");
const speedLimitInput = document.getElementById("speedLimit"); // Added
const minSpeedForCrashCheckInput = document.getElementById("minSpeedForCrashCheck");
const maxSpeedAfterCrashInput = document.getElementById("maxSpeedAfterCrash");
const minDecelerationForCrashInput = document.getElementById("minDecelerationForCrash");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");

// Crash Alert elements
const crashAlertInfo = document.getElementById("crashAlertInfo");
const crashLocationDisplay = document.getElementById("crashLocation");
const smsLink = document.getElementById("smsLink");
const resetCrashBtn = document.getElementById("resetCrashBtn");
const speedAlertSound = document.getElementById("speedAlertSound"); // Added Audio Element

// --- State Variables ---
let isMonitoring = false;
let watchId = null;
let previousSpeedKmH = 0;
let crashDetected = false;
let isSpeeding = false; // Added: Track if currently exceeding speed limit

// --- Constants ---
const LOCATION_TIMEOUT = 15000;
const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000
};

// --- Initialization ---
loadSettings();

// --- Event Listeners ---
startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);
saveSettingsBtn.addEventListener("click", saveSettings);
resetCrashBtn.addEventListener("click", resetCrashAlert);

// --- Core Functions ---

function startMonitoring() {
    if (isMonitoring) return;

    // Basic Checks (APIs, Settings)
    if (!("geolocation" in navigator)) {
        monitoringStatus.textContent = "Error: Geolocation API not supported.";
        return;
    }
     if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value) { // Added speed limit check
         monitoringStatus.textContent = "Error: Please set User Name, Contacts, and Speed Limit first.";
         settingsStatus.textContent = "Save settings before starting.";
         settingsStatus.style.color = "red";
         return;
    }

    // Reset state and UI
    monitoringStatus.textContent = "Status: Starting...";
    crashDetected = false;
    isSpeeding = false; // Reset speeding flag
    display.style.color = ''; // Reset display color
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;

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

    // Update UI and reset state
    isMonitoring = false;
    isSpeeding = false; // Reset speeding flag
    startBtn.disabled = false;
    stopBtn.disabled = true;
    monitoringStatus.textContent = "Status: Idle";
    display.textContent = "Speed: 0.0 km/h";
    display.style.color = ''; // Reset display color
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;
    console.log("Monitoring stopped.");
}

function handlePositionUpdate(position) {
    if (!isMonitoring) return; // Exit if not monitoring

    const currentSpeedMPS = position.coords.speed;
    const timestamp = position.timestamp;
    let currentSpeedKmH = 0;
    let speedText = "Speed: N/A";

    if (currentSpeedMPS !== null && currentSpeedMPS >= 0) {
        currentSpeedKmH = currentSpeedMPS * 3.6;
        speedText = `Speed: ${currentSpeedKmH.toFixed(1)} km/h`;
    }
    display.textContent = speedText;

    // --- Speed Limit Alert Logic ---
    if (!crashDetected) { // Only check speed limit if no crash is detected
        const speedLimit = parseFloat(speedLimitInput.value);

        if (!isNaN(speedLimit) && speedAlertSound && currentSpeedKmH > 0) {
            if (currentSpeedKmH > speedLimit && !isSpeeding) {
                // Just started speeding
                isSpeeding = true;
                display.style.color = 'orange'; // Indicate speeding visually
                speedAlertSound.play().catch(e => console.error("Audio play failed:", e));
                console.log(`Speed limit (${speedLimit} km/h) exceeded. Current: ${currentSpeedKmH.toFixed(1)} km/h`);
            } else if (currentSpeedKmH <= speedLimit && isSpeeding) {
                // Just stopped speeding
                isSpeeding = false;
                display.style.color = ''; // Reset color
                // Optional: Stop sound if it loops
                // speedAlertSound.pause();
                // speedAlertSound.currentTime = 0;
                console.log(`Speed back below limit (${speedLimit} km/h). Current: ${currentSpeedKmH.toFixed(1)} km/h`);
            }
        } else if (isSpeeding) {
            // Handles cases where speed becomes N/A or 0 while speeding was true
            isSpeeding = false;
            display.style.color = '';
        }
    } // End of Speed Limit Check Block

    // --- Crash Detection Logic (Only if no crash already detected) ---
    if (!crashDetected) {
        const minSpeedBefore = parseFloat(minSpeedForCrashCheckInput.value);
        const maxSpeedAfter = parseFloat(maxSpeedAfterCrashInput.value);
        const minDeceleration = parseFloat(minDecelerationForCrashInput.value);
        const actualDeceleration = previousSpeedKmH - currentSpeedKmH;

        if (previousSpeedKmH > minSpeedBefore &&
            currentSpeedKmH < maxSpeedAfter &&
            actualDeceleration >= minDeceleration)
        {
            console.log(`CRASH DETECTED (Sudden Stop): Speed dropped from ${previousSpeedKmH.toFixed(1)} to ${currentSpeedKmH.toFixed(1)} km/h (Drop: ${actualDeceleration.toFixed(1)} km/h)`);
            display.style.color = 'red'; // Make speed display red on crash
            triggerCrashAlert(); // Trigger the crash alert process
        }
    } // End of Crash Detection Block

    // Store current speed for the next comparison (only if valid)
    if (currentSpeedMPS !== null) {
       previousSpeedKmH = currentSpeedKmH;
    }
}

function handleGeolocationError(error) {
    monitoringStatus.textContent = `Status: Geolocation Error (${error.code}: ${error.message})`;
    display.textContent = "Speed: Error";
    display.style.color = ''; // Reset color on error
    isSpeeding = false; // Reset speeding state
    console.error("Geolocation Error:", error);
    if (error.code === 1) { // Permission Denied
        stopMonitoring();
         monitoringStatus.textContent = "Status: Geolocation Permission Denied. Monitoring stopped.";
    }
}


function triggerCrashAlert() {
    if (crashDetected) return;
    crashDetected = true;
    isSpeeding = false; // Cannot be speeding if crashed
    display.style.color = 'red'; // Ensure display is red
    monitoringStatus.textContent = "Status: CRASH DETECTED!";
    monitoringStatus.style.color = "red"; // Make status red too
    // Consider stopping speedAlertSound if it was playing?
    // if (speedAlertSound) speedAlertSound.pause();

    crashAlertInfo.style.display = 'block';
    crashLocationDisplay.textContent = "Fetching location...";
    smsLink.style.display = 'none';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            const locationString = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
            const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
            crashLocationDisplay.innerHTML = `Location: ${locationString} (<a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">View Map</a>)`;
            console.log("Location fetched for crash:", locationString);
            prepareSmsLink(latitude, longitude);
        },
        (error) => {
            crashLocationDisplay.textContent = `Location: Error fetching location (${error.message})`;
            console.error("Geolocation error on crash:", error);
            prepareSmsLink(null, null);
        },
        { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 0 }
    );
}

function prepareSmsLink(latitude, longitude) {
    // ... (This function remains the same as before) ...
    const userName = userNameInput.value.trim() || "User";
    const phoneNumbers = getCleanedPhoneNumbers();

    if (phoneNumbers.length === 0) {
        smsLink.textContent = "No emergency contacts saved!";
        smsLink.style.pointerEvents = 'none';
        smsLink.style.backgroundColor = 'grey';
         smsLink.style.color = 'white';
        smsLink.style.padding = '12px 20px';
        smsLink.style.borderRadius = '5px';
        smsLink.style.textDecoration = 'none';
        smsLink.style.display = 'inline-block';
        return;
    }

    let locationText = "an unknown location (location services failed)";
    if (latitude !== null && longitude !== null) {
        locationText = `location Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
    }

    const messageBody = `This is an automatic crash detection alert from ${userName}'s phone. A potential crash (sudden stop) has been detected at ${locationText}. Please contact emergency services or check on them immediately.`;

    const encodedBody = encodeURIComponent(messageBody);
    const numbersString = phoneNumbers.join(',');

    smsLink.href = `sms:${numbersString}?body=${encodedBody}`;
    smsLink.textContent = "Tap Here to SEND Emergency SMS";
    smsLink.style.display = 'inline-block';
    smsLink.style.marginTop = '15px';
    smsLink.style.padding = '12px 20px';
    smsLink.style.backgroundColor = 'red';
    smsLink.style.color = 'white';
    smsLink.style.textDecoration = 'none';
    smsLink.style.borderRadius = '5px';
    smsLink.style.fontWeight = 'bold';
    smsLink.style.textAlign = 'center';
    smsLink.style.pointerEvents = 'auto';

    console.log("SMS link prepared for:", numbersString);
}

function resetCrashAlert() {
    crashDetected = false;
    crashAlertInfo.style.display = 'none';
    smsLink.href = '#';
    smsLink.style.display = 'none';
    monitoringStatus.textContent = isMonitoring ? "Status: Monitoring speed..." : "Status: Idle";
    monitoringStatus.style.color = ""; // Reset status color
    display.style.color = ''; // Reset display color (speeding state will be re-evaluated)
    isSpeeding = false; // Explicitly reset speeding state here too
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
    const userName = userNameInput.value.trim();
    const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value; // Added
    const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value;
    const minDecel = minDecelerationForCrashInput.value;

    // Basic validation
    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel ) { // Check all fields
        settingsStatus.textContent = "Please fill in all setting fields.";
        settingsStatus.style.color = "red";
        return;
    }
    const phoneNumbersClean = getCleanedPhoneNumbers(phoneNumbersRaw);
     if (phoneNumbersClean.length === 0) {
        settingsStatus.textContent = "No valid PH phone numbers. Use 09xxxxxxxxx or +639xxxxxxxxx, comma-separated.";
        settingsStatus.style.color = "red";
        return;
    }

    // Save all settings
    localStorage.setItem('crashDetectorUserName', userName);
    localStorage.setItem('crashDetectorPhoneNumbers', phoneNumbersRaw);
    localStorage.setItem('crashDetectorSpeedLimit', speedLimit); // Added
    localStorage.setItem('crashDetectorMinSpeed', minSpeed);
    localStorage.setItem('crashDetectorMaxSpeed', maxSpeed);
    localStorage.setItem('crashDetectorMinDecel', minDecel);

    settingsStatus.textContent = "Settings saved successfully!";
    settingsStatus.style.color = "green";
    console.log("Settings saved:", { userName, phoneNumbersRaw, speedLimit, minSpeed, maxSpeed, minDecel });

    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    const savedName = localStorage.getItem('crashDetectorUserName');
    const savedNumbers = localStorage.getItem('crashDetectorPhoneNumbers');
    const savedSpeedLimit = localStorage.getItem('crashDetectorSpeedLimit'); // Added
    const savedMinSpeed = localStorage.getItem('crashDetectorMinSpeed');
    const savedMaxSpeed = localStorage.getItem('crashDetectorMaxSpeed');
    const savedMinDecel = localStorage.getItem('crashDetectorMinDecel');

    if (savedName) userNameInput.value = savedName;
    if (savedNumbers) phoneNumbersInput.value = savedNumbers;
    if (savedSpeedLimit) speedLimitInput.value = savedSpeedLimit; // Added
    if (savedMinSpeed) minSpeedForCrashCheckInput.value = savedMinSpeed;
    if (savedMaxSpeed) maxSpeedAfterCrashInput.value = savedMaxSpeed;
    if (savedMinDecel) minDecelerationForCrashInput.value = savedMinDecel;

    console.log("Settings loaded.");
}

// --- Utility Functions ---

function getCleanedPhoneNumbers(rawString = null) {
    // ... (This function remains the same as before) ...
    const inputString = rawString === null ? phoneNumbersInput.value : rawString;
    const phRegex = /^(09\d{9}|\+639\d{9})$/;
    return inputString
        .split(',')
        .map(num => num.trim())
        .filter(num => phRegex.test(num));
}