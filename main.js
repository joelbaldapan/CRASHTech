// --- DOM Elements ---
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const monitoringStatus = document.getElementById("monitoringStatus");
const display = document.getElementById("display");
const speedLog = document.getElementById("speedLog"); // Added Speed Log UL element

// Settings elements
// ... (keep all settings elements)
const speedLimitInput = document.getElementById("speedLimit");

// Crash Alert elements
// ... (keep all crash alert elements)
const speedAlertSound = document.getElementById("speedAlertSound");

// --- State Variables ---
// ... (keep isMonitoring, watchId, previousSpeedKmH, crashDetected, isSpeeding)
let isMonitoring = false;
let watchId = null;
let previousSpeedKmH = 0;
let crashDetected = false;
let isSpeeding = false;

// --- Constants ---
const LOCATION_TIMEOUT = 15000;
const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000
};
const MAX_LOG_ENTRIES = 100; // Limit the number of log entries

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

    // Basic Checks...
    if (!("geolocation" in navigator)) { /* ... */ return; }
    if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value) { /* ... */ return; }

    // Reset state and UI
    monitoringStatus.textContent = "Status: Starting...";
    crashDetected = false;
    isSpeeding = false;
    display.style.color = '';
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;
    if (speedLog) speedLog.innerHTML = ""; // Clear the speed log

    // Start Geolocation Watch...
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
    } else { /* ... */ }
}

function stopMonitoring() {
    if (!isMonitoring || watchId === null) return;

    navigator.geolocation.clearWatch(watchId);
    watchId = null;

    // Update UI and reset state...
    isMonitoring = false;
    isSpeeding = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    monitoringStatus.textContent = "Status: Idle";
    display.textContent = "Speed: 0.0 km/h";
    display.style.color = '';
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;
    // Don't clear the log on stop, user might want to see it
    console.log("Monitoring stopped.");
}

function handlePositionUpdate(position) {
    if (!isMonitoring) return;

    const currentSpeedMPS = position.coords.speed;
    const timestamp = position.timestamp; // Use timestamp from position data
    let currentSpeedKmH = 0;
    let speedText = "Speed: N/A"; // Default text

    if (currentSpeedMPS !== null && currentSpeedMPS >= 0) {
        currentSpeedKmH = currentSpeedMPS * 3.6;
        speedText = `Speed: ${currentSpeedKmH.toFixed(1)} km/h`;
    }
    display.textContent = speedText;

    // --- Speed Log Logic ---
    if (speedLog) {
        const currentTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); // Format time

        // Limit log entries
        while (speedLog.children.length >= MAX_LOG_ENTRIES) {
            speedLog.removeChild(speedLog.firstChild); // Remove the oldest entry
        }

        // Append new entry
        const listItem = document.createElement("li");
        // Use the speedText which already has "km/h" or "N/A"
        listItem.textContent = `${currentTime} - ${speedText}`;
        speedLog.appendChild(listItem);
        // Optional: Scroll to bottom
        // speedLog.scrollTop = speedLog.scrollHeight;
    }
    // --- End Speed Log Logic ---


    // --- Speed Limit Alert Logic ---
    // ... (keep the existing speed limit logic)
    if (!crashDetected) {
        const speedLimit = parseFloat(speedLimitInput.value);
        if (!isNaN(speedLimit) && speedAlertSound && currentSpeedKmH > 0) {
             if (currentSpeedKmH > speedLimit && !isSpeeding) {
                isSpeeding = true;
                display.style.color = 'orange';
                speedAlertSound.play().catch(e => console.error("Audio play failed:", e));
                console.log(`Speed limit (${speedLimit} km/h) exceeded. Current: ${currentSpeedKmH.toFixed(1)} km/h`);
            } else if (currentSpeedKmH <= speedLimit && isSpeeding) {
                isSpeeding = false;
                display.style.color = '';
                console.log(`Speed back below limit (${speedLimit} km/h). Current: ${currentSpeedKmH.toFixed(1)} km/h`);
            }
        } else if (isSpeeding) {
            isSpeeding = false;
            display.style.color = '';
        }
    }
    // --- End Speed Limit Alert Logic ---


    // --- Crash Detection Logic ---
    // ... (keep the existing crash detection logic)
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
            display.style.color = 'red';
            triggerCrashAlert();
        }
    }
    // --- End Crash Detection Logic ---


    // Store current speed for the next comparison
    if (currentSpeedMPS !== null) {
       previousSpeedKmH = currentSpeedKmH;
    }
}

// --- Other Functions (handleGeolocationError, triggerCrashAlert, prepareSmsLink, resetCrashAlert, saveSettings, loadSettings, getCleanedPhoneNumbers) ---
// Keep these functions exactly as they were in the previous version.

function handleGeolocationError(error) {
    // ... (no changes needed here) ...
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
    // ... (no changes needed here) ...
    if (crashDetected) return;
    crashDetected = true;
    isSpeeding = false;
    display.style.color = 'red';
    monitoringStatus.textContent = "Status: CRASH DETECTED!";
    monitoringStatus.style.color = "red";
    // if (speedAlertSound) speedAlertSound.pause(); // Consider pausing alert sound

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
    // ... (no changes needed here) ...
    const userName = userNameInput.value.trim() || "User";
    const phoneNumbers = getCleanedPhoneNumbers();
    if (phoneNumbers.length === 0) { /* ... handle no numbers ... */ return; }
    let locationText = "an unknown location (location services failed)";
    if (latitude !== null && longitude !== null) {
        locationText = `location Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
    }
    const messageBody = `This is an automatic crash detection alert from ${userName}'s phone. A potential crash (sudden stop) has been detected at ${locationText}. Please contact emergency services or check on them immediately.`;
    const encodedBody = encodeURIComponent(messageBody);
    const numbersString = phoneNumbers.join(',');
    smsLink.href = `sms:${numbersString}?body=${encodedBody}`;
    // ... (set styles for smsLink) ...
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
    // ... (no changes needed here) ...
    crashDetected = false;
    crashAlertInfo.style.display = 'none';
    smsLink.href = '#';
    smsLink.style.display = 'none';
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

function saveSettings() {
    // ... (no changes needed here) ...
    const userName = userNameInput.value.trim();
    const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value;
    const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value;
    const minDecel = minDecelerationForCrashInput.value;
    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel ) { /* ... */ return; }
    const phoneNumbersClean = getCleanedPhoneNumbers(phoneNumbersRaw);
    if (phoneNumbersClean.length === 0) { /* ... */ return; }
    localStorage.setItem('crashDetectorUserName', userName);
    localStorage.setItem('crashDetectorPhoneNumbers', phoneNumbersRaw);
    localStorage.setItem('crashDetectorSpeedLimit', speedLimit);
    localStorage.setItem('crashDetectorMinSpeed', minSpeed);
    localStorage.setItem('crashDetectorMaxSpeed', maxSpeed);
    localStorage.setItem('crashDetectorMinDecel', minDecel);
    settingsStatus.textContent = "Settings saved successfully!";
    settingsStatus.style.color = "green";
    console.log("Settings saved:", { userName, phoneNumbersRaw, speedLimit, minSpeed, maxSpeed, minDecel });
    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    // ... (no changes needed here) ...
    const savedName = localStorage.getItem('crashDetectorUserName');
    const savedNumbers = localStorage.getItem('crashDetectorPhoneNumbers');
    const savedSpeedLimit = localStorage.getItem('crashDetectorSpeedLimit');
    const savedMinSpeed = localStorage.getItem('crashDetectorMinSpeed');
    const savedMaxSpeed = localStorage.getItem('crashDetectorMaxSpeed');
    const savedMinDecel = localStorage.getItem('crashDetectorMinDecel');
    if (savedName) userNameInput.value = savedName;
    if (savedNumbers) phoneNumbersInput.value = savedNumbers;
    if (savedSpeedLimit) speedLimitInput.value = savedSpeedLimit;
    if (savedMinSpeed) minSpeedForCrashCheckInput.value = savedMinSpeed;
    if (savedMaxSpeed) maxSpeedAfterCrashInput.value = savedMaxSpeed;
    if (savedMinDecel) minDecelerationForCrashInput.value = savedMinDecel;
    console.log("Settings loaded.");
}

function getCleanedPhoneNumbers(rawString = null) {
    // ... (no changes needed here) ...
    const inputString = rawString === null ? phoneNumbersInput.value : rawString;
    const phRegex = /^(09\d{9}|\+639\d{9})$/;
    return inputString
        .split(',')
        .map(num => num.trim())
        .filter(num => phRegex.test(num));
}