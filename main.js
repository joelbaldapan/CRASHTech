// --- DOM Elements ---
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const monitoringStatus = document.getElementById("monitoringStatus");
const display = document.getElementById("display"); // Speed display
// const speedLog = document.getElementById("speedLog"); // Uncomment if using speed log

// Settings elements
const userNameInput = document.getElementById("userName");
const phoneNumbersInput = document.getElementById("phoneNumbers");
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
// const crashAlertSound = document.getElementById("crashAlertSound"); // Uncomment if using sound

// --- State Variables ---
let isMonitoring = false;
let watchId = null; // For geolocation watchPosition
let previousSpeedKmH = 0; // Store the last known speed
let crashDetected = false;

// --- Constants ---
const LOCATION_TIMEOUT = 15000; // Max time to wait for location (ms)
const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true, // Request highest accuracy
    maximumAge: 5000,        // Don't use cached position older than 5s
    timeout: 10000           // Give up after 10s if no position
};

// --- Initialization ---
loadSettings(); // Load saved settings on startup

// --- Event Listeners ---
startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);
saveSettingsBtn.addEventListener("click", saveSettings);
resetCrashBtn.addEventListener("click", resetCrashAlert);

// --- Core Functions ---

function startMonitoring() {
    if (isMonitoring) return;

    // 1. Check for necessary APIs and Settings
    if (!("geolocation" in navigator)) {
        monitoringStatus.textContent = "Error: Geolocation API not supported.";
        return;
    }
     if (!userNameInput.value || !phoneNumbersInput.value) {
         monitoringStatus.textContent = "Error: Please set User Name and Emergency Contacts first.";
         settingsStatus.textContent = "Save settings before starting.";
         settingsStatus.style.color = "red";
         return;
    }


    // 2. Reset state and UI
    monitoringStatus.textContent = "Status: Starting...";
    crashDetected = false;
    crashAlertInfo.style.display = 'none';
    // if (speedLog) speedLog.innerHTML = ""; // Clear log if using
    previousSpeedKmH = 0; // Reset previous speed

    // 3. Start Geolocation Watch
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            handlePositionUpdate,
            handleGeolocationError,
            GEOLOCATION_OPTIONS
        );

        // 4. Update UI
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

    // Stop Geolocation Watch
    navigator.geolocation.clearWatch(watchId);
    watchId = null;

    // Update UI
    isMonitoring = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    monitoringStatus.textContent = "Status: Idle";
    display.textContent = "Speed: 0.0 km/h"; // Reset speed display
    crashAlertInfo.style.display = 'none'; // Hide alert
    previousSpeedKmH = 0;
    console.log("Monitoring stopped.");
}

function handlePositionUpdate(position) {
    if (!isMonitoring || crashDetected) return; // Stop processing if not monitoring or crash already flagged

    const currentSpeedMPS = position.coords.speed; // Speed in meters per second
    const timestamp = position.timestamp; // Time of the reading

    // Update Speed Display
    let currentSpeedKmH = 0;
    let speedText = "Speed: N/A";
    if (currentSpeedMPS !== null && currentSpeedMPS >= 0) {
         // Convert m/s to km/h
        currentSpeedKmH = (currentSpeedMPS * 3.6);
        speedText = `Speed: ${currentSpeedKmH.toFixed(1)} km/h`;
    }
    display.textContent = speedText;

    // Log speed (Optional)
    // const currentTime = new Date(timestamp).toLocaleTimeString();
    // if (speedLog) {
    //     const listItem = document.createElement("li");
    //     listItem.textContent = `${currentTime} - ${speedText}`;
    //     // Keep log from getting too long
    //     if(speedLog.children.length > 50) {
    //         speedLog.removeChild(speedLog.firstChild);
    //     }
    //     speedLog.appendChild(listItem);
    // }


    // --- Crash Detection Logic (Sudden Deceleration) ---
    const minSpeedBefore = parseFloat(minSpeedForCrashCheckInput.value);
    const maxSpeedAfter = parseFloat(maxSpeedAfterCrashInput.value);
    const minDeceleration = parseFloat(minDecelerationForCrashInput.value);
    const actualDeceleration = previousSpeedKmH - currentSpeedKmH;

    // Check if speed dropped significantly from a notable speed
    if ( previousSpeedKmH > minSpeedBefore && // Were we going fast enough before?
         currentSpeedKmH < maxSpeedAfter && // Have we slowed down significantly now?
         actualDeceleration >= minDeceleration // Was the drop rapid enough?
       )
    {
        console.log(`CRASH DETECTED (Sudden Stop): Speed dropped from ${previousSpeedKmH.toFixed(1)} to ${currentSpeedKmH.toFixed(1)} km/h (Drop: ${actualDeceleration.toFixed(1)} km/h)`);
        triggerCrashAlert(); // Trigger the alert process
    }

    // Store current speed for the next comparison
    previousSpeedKmH = currentSpeedKmH;
}

function handleGeolocationError(error) {
    monitoringStatus.textContent = `Status: Geolocation Error (${error.code}: ${error.message})`;
    display.textContent = "Speed: Error";
    console.error("Geolocation Error:", error);
    // Consider stopping monitoring on certain errors? e.g., permission denied (error.code === 1)
    if (error.code === 1) {
        stopMonitoring();
         monitoringStatus.textContent = "Status: Geolocation Permission Denied. Monitoring stopped.";
    }
}


function triggerCrashAlert() {
    if (crashDetected) return; // Prevent multiple triggers for one event
    crashDetected = true;
    monitoringStatus.textContent = "Status: CRASH DETECTED!";
    monitoringStatus.style.color = "red";
    // if (crashAlertSound) crashAlertSound.play(); // Play sound

    // Show the alert box
    crashAlertInfo.style.display = 'block';
    crashLocationDisplay.textContent = "Fetching location...";
    smsLink.style.display = 'none'; // Hide SMS link until location is ready

    // Get current location *immediately* for the alert
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            const locationString = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
             // Include Google Maps link
             const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

            crashLocationDisplay.innerHTML = `Location: ${locationString} (<a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">View Map</a>)`;
            console.log("Location fetched for crash:", locationString);

            // Prepare and enable the SMS link
            prepareSmsLink(latitude, longitude);
        },
        (error) => {
            crashLocationDisplay.textContent = `Location: Error fetching location (${error.message})`;
            console.error("Geolocation error on crash:", error);
            // Still prepare SMS link, but with location unknown
            prepareSmsLink(null, null);
        },
        { // Options for this specific location request
            enableHighAccuracy: true,
            timeout: LOCATION_TIMEOUT,
            maximumAge: 0 // Force fresh location data
        }
    );
}

function prepareSmsLink(latitude, longitude) {
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
        smsLink.style.display = 'inline-block'; // Make it visible but disabled-looking
        return;
    }

    let locationText = "an unknown location (location services failed)";
    if (latitude !== null && longitude !== null) {
        locationText = `location Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
        // You could add the map link in the SMS too if desired (might make SMS long)
        // locationText += ` (Map: https://www.google.com/maps?q=${latitude},${longitude})`;
    }

    const messageBody = `This is an automatic crash detection alert from ${userName}'s phone. A potential crash (sudden stop) has been detected at ${locationText}. Please contact emergency services or check on them immediately.`;

    // Format for the sms: URI scheme
    const encodedBody = encodeURIComponent(messageBody);
    const numbersString = phoneNumbers.join(','); // Comma-separate numbers

    // --- SMS Sending Point (Manual via sms: link) ---
    smsLink.href = `sms:${numbersString}?body=${encodedBody}`;
    smsLink.textContent = "Tap Here to SEND Emergency SMS";
    // Apply styling for the link
    smsLink.style.display = 'inline-block';
    smsLink.style.marginTop = '15px';
    smsLink.style.padding = '12px 20px';
    smsLink.style.backgroundColor = 'red';
    smsLink.style.color = 'white';
    smsLink.style.textDecoration = 'none';
    smsLink.style.borderRadius = '5px';
    smsLink.style.fontWeight = 'bold';
    smsLink.style.textAlign = 'center';
    smsLink.style.pointerEvents = 'auto'; // Ensure it's clickable

    console.log("SMS link prepared for:", numbersString);

     // --- Backend Call Placeholder ---
     // If you implement a backend later, the call would go here instead of/in addition to setting the sms: link.
     /*
     sendCrashDataToBackend({
         userName: userName,
         recipients: phoneNumbers,
         latitude: latitude,
         longitude: longitude,
         message: messageBody // Or let backend construct it
     });
     */
}

/* // Placeholder for backend function
function sendCrashDataToBackend(payload) {
    console.log("Sending data to backend (not implemented):", payload);
    // fetch('/api/send-crash-sms', { method: 'POST', ... });
}
*/

function resetCrashAlert() {
    crashDetected = false;
    crashAlertInfo.style.display = 'none';
    smsLink.href = '#'; // Clear link
    smsLink.style.display = 'none'; // Hide link again
    monitoringStatus.textContent = isMonitoring ? "Status: Monitoring speed..." : "Status: Idle";
    monitoringStatus.style.color = ""; // Reset color
    previousSpeedKmH = 0; // Reset speed memory
    console.log("Crash alert reset.");
    // If stopped during crash, ensure it remains stopped
    if (!isMonitoring && watchId === null) { // Check watchId too
       stopBtn.disabled = true;
       startBtn.disabled = false;
    } else if (isMonitoring) {
         monitoringStatus.textContent = "Status: Monitoring speed..."; // Re-affirm monitoring state
    }
}


// --- Settings Persistence ---

function saveSettings() {
    const userName = userNameInput.value.trim();
    const phoneNumbersRaw = phoneNumbersInput.value.trim();
    // Get threshold values
    const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value;
    const minDecel = minDecelerationForCrashInput.value;

    // Basic validation
    if (!userName) {
        settingsStatus.textContent = "User Name cannot be empty.";
        settingsStatus.style.color = "red";
        return;
    }
     if (!phoneNumbersRaw) {
        settingsStatus.textContent = "Emergency Contacts cannot be empty.";
        settingsStatus.style.color = "red";
        return;
    }
    const phoneNumbersClean = getCleanedPhoneNumbers(phoneNumbersRaw);
     if (phoneNumbersClean.length === 0) {
        settingsStatus.textContent = "No valid PH phone numbers. Use 09xxxxxxxxx or +639xxxxxxxxx, comma-separated.";
        settingsStatus.style.color = "red";
        return;
    }
     // Add validation for thresholds if desired (e.g., ensure minSpeed > maxSpeed)


    localStorage.setItem('crashDetectorUserName', userName);
    localStorage.setItem('crashDetectorPhoneNumbers', phoneNumbersRaw);
    localStorage.setItem('crashDetectorMinSpeed', minSpeed);
    localStorage.setItem('crashDetectorMaxSpeed', maxSpeed);
    localStorage.setItem('crashDetectorMinDecel', minDecel);


    settingsStatus.textContent = "Settings saved successfully!";
    settingsStatus.style.color = "green";
    console.log("Settings saved:", { userName, phoneNumbersRaw, minSpeed, maxSpeed, minDecel });

    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    const savedName = localStorage.getItem('crashDetectorUserName');
    const savedNumbers = localStorage.getItem('crashDetectorPhoneNumbers');
    const savedMinSpeed = localStorage.getItem('crashDetectorMinSpeed');
    const savedMaxSpeed = localStorage.getItem('crashDetectorMaxSpeed');
    const savedMinDecel = localStorage.getItem('crashDetectorMinDecel');


    if (savedName) userNameInput.value = savedName;
    if (savedNumbers) phoneNumbersInput.value = savedNumbers;
    if (savedMinSpeed) minSpeedForCrashCheckInput.value = savedMinSpeed;
    if (savedMaxSpeed) maxSpeedAfterCrashInput.value = savedMaxSpeed;
    if (savedMinDecel) minDecelerationForCrashInput.value = savedMinDecel;

    console.log("Settings loaded.");
}

// --- Utility Functions ---

function getCleanedPhoneNumbers(rawString = null) {
    const inputString = rawString === null ? phoneNumbersInput.value : rawString;
    // Regex updated to allow optional + and ensure correct digits for PH numbers
    const phRegex = /^(09\d{9}|\+639\d{9})$/;
    return inputString
        .split(',')
        .map(num => num.trim())
        .filter(num => phRegex.test(num));
}