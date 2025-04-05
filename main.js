// --- DOM Elements ---
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const monitoringStatus = document.getElementById("monitoringStatus");
const display = document.getElementById("display");
const speedLog = document.getElementById("speedLog"); // Speed Log UL element

// Settings elements
const userNameInput = document.getElementById("userName");
const phoneNumbersInput = document.getElementById("phoneNumbers");
const speedLimitInput = document.getElementById("speedLimit");
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
const speedAlertSound = document.getElementById("speedAlertSound"); // Audio Element

// --- State Variables ---
let isMonitoring = false;
let watchId = null; // Geolocation watch ID
let previousSpeedKmH = 0; // Store the last known speed for deceleration check
let crashDetected = false; // Flag for crash state
let isSpeeding = false; // Track if currently exceeding speed limit

// --- Constants ---
const LOCATION_TIMEOUT = 15000; // Max time (ms) to wait for location during crash alert
const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true, // Request high accuracy
    maximumAge: 5000,        // Don't use cached position older than 5s for continuous tracking
    timeout: 10000           // Give up after 10s if no position update during continuous tracking
};
const MAX_LOG_ENTRIES = 100; // Limit the number of speed log entries

// --- Initialization ---
loadSettings(); // Load saved settings on page load

// --- Event Listeners ---
startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);
saveSettingsBtn.addEventListener("click", saveSettings);
resetCrashBtn.addEventListener("click", resetCrashAlert);

// --- Core Functions ---

/**
 * Starts the monitoring process: clears log, resets state, starts geolocation watch.
 */
function startMonitoring() {
    if (isMonitoring) return; // Prevent multiple starts

    // Basic Checks: Ensure necessary APIs exist and settings are filled
    if (!("geolocation" in navigator)) {
        monitoringStatus.textContent = "Error: Geolocation API not supported.";
        return;
    }
     // Check if essential settings have values
     if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value || !minSpeedForCrashCheckInput.value || !maxSpeedAfterCrashInput.value || !minDecelerationForCrashInput.value ) {
         monitoringStatus.textContent = "Error: Please fill in all settings first.";
         settingsStatus.textContent = "Save settings before starting.";
         settingsStatus.style.color = "red";
         return;
    }

    // Reset state and UI elements
    monitoringStatus.textContent = "Status: Starting...";
    monitoringStatus.style.color = "";
    crashDetected = false;
    isSpeeding = false;
    display.style.color = ''; // Reset display color
    crashAlertInfo.style.display = 'none'; // Hide crash alert box
    previousSpeedKmH = 0; // Reset previous speed
    if (speedLog) speedLog.innerHTML = ""; // Clear the speed log display

    // Start Geolocation Watch
    if (navigator.geolocation) {
        // Request position updates
        watchId = navigator.geolocation.watchPosition(
            handlePositionUpdate,       // Success callback
            handleGeolocationError,     // Error callback
            GEOLOCATION_OPTIONS         // Options
        );

        // Update UI to reflect monitoring state
        isMonitoring = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        monitoringStatus.textContent = "Status: Monitoring speed...";
        console.log("Monitoring started with watchId:", watchId);
    } else {
         monitoringStatus.textContent = "Error: Geolocation is not available.";
    }
}

/**
 * Stops the monitoring process: clears geolocation watch, resets UI.
 */
function stopMonitoring() {
    if (!isMonitoring || watchId === null) return; // Prevent multiple stops or stopping if not started

    navigator.geolocation.clearWatch(watchId); // Stop watching position
    watchId = null;

    // Update UI and reset state
    isMonitoring = false;
    isSpeeding = false; // Reset speeding flag
    startBtn.disabled = false;
    stopBtn.disabled = true;
    monitoringStatus.textContent = "Status: Idle";
    display.textContent = "Speed: 0.0 km/h"; // Reset speed display
    display.style.color = ''; // Reset display color
    crashAlertInfo.style.display = 'none'; // Hide crash alert if visible
    previousSpeedKmH = 0;
    // Note: We don't clear the log on stop, user might want to review it.
    console.log("Monitoring stopped.");
}

/**
 * Handles successful position updates from watchPosition.
 * Updates speed display, adds to log, checks speed limit, checks for crash condition.
 */
function handlePositionUpdate(position) {
    if (!isMonitoring) return; // Exit if monitoring was stopped between updates

    const currentSpeedMPS = position.coords.speed; // Speed in meters per second from GPS
    const timestamp = position.timestamp; // Time of the reading from GPS
    let currentSpeedKmH = 0;
    let speedText = "Speed: N/A"; // Default text if speed is null

    // Calculate speed in km/h if available
    if (currentSpeedMPS !== null && currentSpeedMPS >= 0) { // Check for valid speed
        currentSpeedKmH = currentSpeedMPS * 3.6;
        speedText = `Speed: ${currentSpeedKmH.toFixed(1)} km/h`;
    }
    display.textContent = speedText; // Update main speed display

    // --- Speed Log Logic ---
    if (speedLog) {
        // Format time from the position timestamp
        const currentTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Limit the number of log entries to avoid performance issues
        while (speedLog.children.length >= MAX_LOG_ENTRIES) {
            speedLog.removeChild(speedLog.firstChild); // Remove the oldest (top) entry
        }

        // Create and append the new log entry
        const listItem = document.createElement("li");
        // Use the formatted speedText which includes units or "N/A"
        listItem.textContent = `${currentTime} - ${speedText}`;
        speedLog.appendChild(listItem);
        // Optional: Auto-scroll to the bottom of the log
        speedLog.scrollTop = speedLog.scrollHeight;
    }
    // --- End Speed Log Logic ---


    // --- Speed Limit Alert Logic ---
    // Only check speed limit if no crash is currently detected
    if (!crashDetected) {
        const speedLimit = parseFloat(speedLimitInput.value); // Get limit from input

        // Check if speed limit is a valid number, sound element exists, and we have a valid speed
        if (!isNaN(speedLimit) && speedAlertSound && currentSpeedKmH > 0) {
            if (currentSpeedKmH > speedLimit && !isSpeeding) {
                // Condition: Speed just exceeded the limit
                isSpeeding = true; // Set the speeding flag
                display.style.color = 'orange'; // Indicate speeding visually
                speedAlertSound.play().catch(e => console.error("Audio play failed:", e)); // Play sound, catch potential errors
                console.log(`Speed limit (${speedLimit} km/h) exceeded. Current: ${currentSpeedKmH.toFixed(1)} km/h`);
            } else if (currentSpeedKmH <= speedLimit && isSpeeding) {
                // Condition: Speed just dropped back below the limit
                isSpeeding = false; // Reset the speeding flag
                display.style.color = ''; // Reset display color
                // Optional: Explicitly stop sound if it loops (uncomment if needed)
                // speedAlertSound.pause();
                // speedAlertSound.currentTime = 0;
                console.log(`Speed back below limit (${speedLimit} km/h). Current: ${currentSpeedKmH.toFixed(1)} km/h`);
            }
        } else if (isSpeeding) {
            // Handle cases where speed becomes N/A or 0 while speeding was true
            isSpeeding = false;
            display.style.color = '';
        }
    } // End of Speed Limit Check Block


    // --- Crash Detection Logic (Sudden Deceleration) ---
    // Only check for crash if no crash is currently detected
    if (!crashDetected) {
        // Get crash detection thresholds from input fields
        const minSpeedBefore = parseFloat(minSpeedForCrashCheckInput.value);
        const maxSpeedAfter = parseFloat(maxSpeedAfterCrashInput.value);
        const minDeceleration = parseFloat(minDecelerationForCrashInput.value);
        const actualDeceleration = previousSpeedKmH - currentSpeedKmH; // Calculate speed drop

        // Check conditions for a potential crash event
        if ( previousSpeedKmH > minSpeedBefore &&      // Were we going fast enough before?
             currentSpeedKmH < maxSpeedAfter &&        // Have we slowed down significantly now?
             actualDeceleration >= minDeceleration &&  // Was the drop in speed rapid enough?
             currentSpeedMPS !== null                  // Ensure current speed reading is valid
           )
        {
            // Log detection details
            console.log(`CRASH DETECTED (Sudden Stop): Speed dropped from ${previousSpeedKmH.toFixed(1)} to ${currentSpeedKmH.toFixed(1)} km/h (Drop: ${actualDeceleration.toFixed(1)} km/h)`);
            display.style.color = 'red'; // Make speed display red to indicate crash state
            triggerCrashAlert(); // Initiate the crash alert sequence
        }
    } // End of Crash Detection Block


    // Store the current speed (if valid) to compare against the next update
    if (currentSpeedMPS !== null) {
       previousSpeedKmH = currentSpeedKmH;
    }
}

/**
 * Handles errors from watchPosition.
 */
function handleGeolocationError(error) {
    monitoringStatus.textContent = `Status: Geolocation Error (${error.code}: ${error.message})`;
    display.textContent = "Speed: Error";
    display.style.color = ''; // Reset color on error
    isSpeeding = false; // Reset speeding state
    console.error("Geolocation Error:", error);

    // Handle specific errors
    if (error.code === 1) { // PERMISSION_DENIED
        stopMonitoring(); // Stop monitoring if permission is denied
         monitoringStatus.textContent = "Status: Geolocation Permission Denied. Monitoring stopped.";
    }
    // Could add handling for POSITION_UNAVAILABLE (code 2) or TIMEOUT (code 3) if needed
}

/**
 * Initiates the crash alert process: sets flags, gets location, prepares SMS link.
 */
function triggerCrashAlert() {
    if (crashDetected) return; // Prevent triggering multiple times for one event

    crashDetected = true; // Set the global crash flag
    isSpeeding = false; // Ensure speeding state is off during crash alert
    display.style.color = 'red'; // Ensure display stays red
    monitoringStatus.textContent = "Status: CRASH DETECTED!";
    monitoringStatus.style.color = "red"; // Make status text red

    // Optional: Stop the speed alert sound if it was playing
    // if (speedAlertSound) { speedAlertSound.pause(); speedAlertSound.currentTime = 0; }

    // Show the crash alert UI section
    crashAlertInfo.style.display = 'block';
    crashLocationDisplay.textContent = "Fetching location..."; // Initial message
    smsLink.style.display = 'none'; // Hide SMS link until location is ready

    // Get a fresh, high-accuracy location reading *now* for the alert message
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // Location successfully obtained
            const { latitude, longitude } = position.coords;
            const locationString = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
            // Create a Google Maps link for convenience
            const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
            // Update the UI with the location and map link
            crashLocationDisplay.innerHTML = `Location: ${locationString} (<a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">View Map</a>)`;
            console.log("Location fetched for crash:", locationString);

            // Now that we have location, prepare the SMS link
            prepareSmsLink(latitude, longitude);
        },
        (error) => {
            // Failed to get location for the alert
            crashLocationDisplay.textContent = `Location: Error fetching location (${error.message})`;
            console.error("Geolocation error on crash:", error);
            // Still prepare the SMS link, but indicate location is unknown
            prepareSmsLink(null, null);
        },
        { // Options for this specific, one-time location request
            enableHighAccuracy: true,   // Prioritize accuracy
            timeout: LOCATION_TIMEOUT,  // Set a timeout
            maximumAge: 0               // Force a fresh reading, ignore cache
        }
    );
}

/**
 * Prepares the SMS link (sms: URI) with recipient numbers and the message body.
 * @param {number|null} latitude - The latitude coordinate, or null if unavailable.
 * @param {number|null} longitude - The longitude coordinate, or null if unavailable.
 */
function prepareSmsLink(latitude, longitude) {
    const userName = userNameInput.value.trim() || "User"; // Get user name or use default
    const phoneNumbers = getCleanedPhoneNumbers(); // Get validated phone numbers

    // Handle case where no valid numbers are saved
    if (phoneNumbers.length === 0) {
        smsLink.textContent = "No emergency contacts saved!";
        // Style the link to appear disabled
        smsLink.style.pointerEvents = 'none';
        smsLink.style.backgroundColor = 'grey';
        smsLink.style.color = 'white';
        smsLink.style.padding = '12px 20px';
        smsLink.style.borderRadius = '5px';
        smsLink.style.textDecoration = 'none';
        smsLink.style.display = 'inline-block';
        return; // Exit function
    }

    // Construct the location part of the message
    let locationText = "an unknown location (location services failed)";
    if (latitude !== null && longitude !== null) {
        locationText = `location Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
        // Optional: Include map link directly in SMS body (can make it long)
        // locationText += ` (Map: https://www.google.com/maps?q=${latitude},${longitude})`;
    }

    // Construct the full SMS message body
    // Updated current date to include year: April 6, 2025
    const messageBody = `This is an automatic crash detection alert from ${userName}'s phone. A potential crash (sudden stop) has been detected around ${new Date().toLocaleTimeString()} on April 6, 2025 at ${locationText}. Please contact emergency services or check on them immediately.`;

    // Format for the sms: URI scheme
    const encodedBody = encodeURIComponent(messageBody); // Ensure special characters work
    const numbersString = phoneNumbers.join(','); // Comma-separate numbers for the URI

    // --- Set up the SMS Link (Manual Send Trigger) ---
    smsLink.href = `sms:${numbersString}?body=${encodedBody}`;
    smsLink.textContent = "Tap Here to SEND Emergency SMS";
    // Apply necessary styles to make the link visible and styled as a button
    smsLink.style.display = 'inline-block';
    smsLink.style.marginTop = '15px';
    smsLink.style.padding = '12px 20px';
    smsLink.style.backgroundColor = 'red';
    smsLink.style.color = 'white';
    smsLink.style.textDecoration = 'none';
    smsLink.style.borderRadius = '5px';
    smsLink.style.fontWeight = 'bold';
    smsLink.style.textAlign = 'center';
    smsLink.style.pointerEvents = 'auto'; // Make it clickable

    console.log("SMS link prepared for:", numbersString);

    // --- Backend Call Placeholder ---
    // If implementing automatic sending later, the API call would go here.
    /*
    sendCrashDataToBackend({
        userName: userName, recipients: phoneNumbers, latitude: latitude, longitude: longitude, message: messageBody
    });
    */
}

/* // Placeholder for backend function concept
function sendCrashDataToBackend(payload) {
    console.log("Sending data to backend (not implemented):", payload);
    // Example: fetch('/api/send-crash-sms', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
}
*/


/**
 * Resets the crash alert state and UI elements.
 */
function resetCrashAlert() {
    crashDetected = false; // Clear the crash flag
    crashAlertInfo.style.display = 'none'; // Hide the alert box
    smsLink.href = '#'; // Clear SMS link href
    smsLink.style.display = 'none'; // Hide SMS link
    monitoringStatus.textContent = isMonitoring ? "Status: Monitoring speed..." : "Status: Idle"; // Reset status text
    monitoringStatus.style.color = ""; // Reset status text color
    display.style.color = ''; // Reset display color (speeding state will be re-evaluated if monitoring)
    isSpeeding = false; // Explicitly reset speeding state
    previousSpeedKmH = 0; // Reset speed memory
    console.log("Crash alert reset.");

    // Ensure button states are correct after reset
    if (!isMonitoring && watchId === null) { // If was stopped before/during crash
       stopBtn.disabled = true;
       startBtn.disabled = false;
    } else if (isMonitoring) { // If still monitoring
         monitoringStatus.textContent = "Status: Monitoring speed..."; // Re-affirm monitoring state text
    }
}


// --- Settings Persistence ---

/**
 * Saves current settings from input fields to localStorage.
 */
function saveSettings() {
    const userName = userNameInput.value.trim();
    const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value;
    const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value;
    const minDecel = minDecelerationForCrashInput.value;

    // Basic validation: Ensure fields are not empty
    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel ) {
        settingsStatus.textContent = "Please fill in all setting fields.";
        settingsStatus.style.color = "red";
        setTimeout(() => { settingsStatus.textContent = ""; }, 3000); // Clear message after 3s
        return;
    }
    // Validate phone numbers format
    const phoneNumbersClean = getCleanedPhoneNumbers(phoneNumbersRaw);
     if (phoneNumbersClean.length === 0) {
        settingsStatus.textContent = "No valid PH phone numbers. Use 09xxxxxxxxx or +639xxxxxxxxx, comma-separated.";
        settingsStatus.style.color = "red";
        setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
        return;
    }
    // Add more specific validation for number ranges if desired

    // Save values to localStorage
    localStorage.setItem('crashDetectorUserName', userName);
    localStorage.setItem('crashDetectorPhoneNumbers', phoneNumbersRaw); // Store raw input for easier editing
    localStorage.setItem('crashDetectorSpeedLimit', speedLimit);
    localStorage.setItem('crashDetectorMinSpeed', minSpeed);
    localStorage.setItem('crashDetectorMaxSpeed', maxSpeed);
    localStorage.setItem('crashDetectorMinDecel', minDecel);

    // Provide user feedback
    settingsStatus.textContent = "Settings saved successfully!";
    settingsStatus.style.color = "green";
    console.log("Settings saved:", { userName, phoneNumbersRaw, speedLimit, minSpeed, maxSpeed, minDecel });
    setTimeout(() => { settingsStatus.textContent = ""; }, 3000); // Clear message
}

/**
 * Loads settings from localStorage into the input fields on page load.
 */
function loadSettings() {
    const savedName = localStorage.getItem('crashDetectorUserName');
    const savedNumbers = localStorage.getItem('crashDetectorPhoneNumbers');
    const savedSpeedLimit = localStorage.getItem('crashDetectorSpeedLimit');
    const savedMinSpeed = localStorage.getItem('crashDetectorMinSpeed');
    const savedMaxSpeed = localStorage.getItem('crashDetectorMaxSpeed');
    const savedMinDecel = localStorage.getItem('crashDetectorMinDecel');

    // Populate fields if saved data exists
    if (savedName) userNameInput.value = savedName;
    if (savedNumbers) phoneNumbersInput.value = savedNumbers;
    if (savedSpeedLimit) speedLimitInput.value = savedSpeedLimit;
    if (savedMinSpeed) minSpeedForCrashCheckInput.value = savedMinSpeed;
    if (savedMaxSpeed) maxSpeedAfterCrashInput.value = savedMaxSpeed;
    if (savedMinDecel) minDecelerationForCrashInput.value = savedMinDecel;

    console.log("Settings loaded.");
}

// --- Utility Functions ---

/**
 * Cleans and validates comma-separated phone numbers from input.
 * @param {string|null} rawString - The raw string from the input field, or null to read directly.
 * @returns {string[]} An array of valid Philippine phone numbers.
 */
function getCleanedPhoneNumbers(rawString = null) {
    const inputString = rawString === null ? phoneNumbersInput.value : rawString;
    // Regex for PH mobile numbers: starts with 09 or +639, followed by 9 digits.
    const phRegex = /^(09\d{9}|\+639\d{9})$/;
    return inputString
        .split(',') // Split by comma
        .map(num => num.trim()) // Remove whitespace around each number
        .filter(num => phRegex.test(num)); // Keep only numbers matching the regex
}