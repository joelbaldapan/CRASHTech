// main.js - COMPLETE CODE

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
const crashTimeoutInput = document.getElementById("crashTimeoutInput");
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

let isMonitoring = false;
let watchId = null;
let previousSpeedKmH = 0;
let crashDetected = false;
let isSpeeding = false;
let helmetStatusIntervalId = null;
let decelerationEventTimestamp = 0;
let impactTimestamp = 0;

const STATUS_INTERVAL = 1000;
const LOCATION_TIMEOUT = 15000;
const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000
};
const MAX_LOG_ENTRIES = 100;
const STORAGE_PREFIX = 'crashDetector_';

loadSettings();

startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);
saveSettingsBtn.addEventListener("click", saveSettings);
resetCrashBtn.addEventListener("click", resetCrashAlert);
if (testSmsBtn) {
    testSmsBtn.addEventListener("click", handleTestSmsClick);
}

function startMonitoring() {
    if (isMonitoring) return;

    if (!("geolocation" in navigator)) {
        monitoringStatus.textContent = "Error: Geolocation not supported.";
        return;
    }
    const backendUrl = backendApiUrlInput.value.trim();

    if (!userNameInput.value || !phoneNumbersInput.value || !speedLimitInput.value ||
        !minSpeedForCrashCheckInput.value || !maxSpeedAfterCrashInput.value || !minDecelerationForCrashInput.value ||
        !crashTimeoutInput.value || !backendUrl ) {
        monitoringStatus.textContent = "Error: Please fill in ALL settings fields, including Crash Detection and Backend URL.";
        settingsStatus.textContent = "Save ALL settings before starting.";
        settingsStatus.style.color = "red";
        return;
    }
    try { new URL(backendUrl); } catch (_) {
         monitoringStatus.textContent = "Error: Invalid format for Backend API URL.";
         settingsStatus.textContent = "Check Backend API URL.";
         settingsStatus.style.color = "red";
         return;
    }
    if (isNaN(parseFloat(crashTimeoutInput.value)) || parseFloat(crashTimeoutInput.value) <= 0) {
        monitoringStatus.textContent = "Error: Crash Timeout must be a positive number.";
        settingsStatus.textContent = "Check Crash Timeout value.";
        settingsStatus.style.color = "red";
        return;
    }

    monitoringStatus.textContent = "Status: Starting...";
    monitoringStatus.style.color = "";
    if (helmetStatusDisplay) {
        helmetStatusDisplay.textContent = "Helmet Status: Initializing...";
        helmetStatusDisplay.style.backgroundColor = '';
        helmetStatusDisplay.style.color = '';
    }
    resetCrashDetectionState();
    isSpeeding = false;
    display.style.color = '';
    display.style.backgroundColor = '';
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;
    if (speedLog) speedLog.innerHTML = "";

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

        fetchHelmetStatus();
        helmetStatusIntervalId = setInterval(fetchHelmetStatus, STATUS_INTERVAL);

    } else {
        monitoringStatus.textContent = "Error: Geolocation is not available.";
    }
}

function stopMonitoring() {
    if (!isMonitoring || watchId === null) return;
    navigator.geolocation.clearWatch(watchId);

    if (helmetStatusIntervalId) { clearInterval(helmetStatusIntervalId); helmetStatusIntervalId = null; }
    if (helmetStatusDisplay) {
        helmetStatusDisplay.textContent = "Helmet Status: Off";
        helmetStatusDisplay.style.backgroundColor = '';
        helmetStatusDisplay.style.color = '';
    }

    // Stop speed alert sound
    if (speedAlertSound) {
        speedAlertSound.loop = false; 
        speedAlertSound.pause();    
        speedAlertSound.currentTime = 0;
        console.log("Speed alert sound stopped.");
    }
    
    watchId = null; isMonitoring = false; isSpeeding = false;
    startBtn.disabled = false; stopBtn.disabled = true;
    monitoringStatus.textContent = "Status: Idle";
    display.textContent = "Speed: 0.0 km/h";
    display.style.color = '';
    display.style.backgroundColor = '';
    crashAlertInfo.style.display = 'none';
    previousSpeedKmH = 0;
    resetCrashDetectionState();
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
    } else {
        previousSpeedKmH = 0;
    }

    if (latitude !== null && longitude !== null) {
        speedText += ` (Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)})`;
    }
    display.textContent = speedText;

    if (!crashDetected && display.style.backgroundColor === 'rgb(255, 221, 221)') {
         display.style.backgroundColor = '';
    }

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
            if (currentSpeedKmH > speedLimit) {
                if (!isSpeeding) {
                    // Just started speeding
                    isSpeeding = true;
                    display.style.color = 'orange';
                    speedAlertSound.loop = true; // Enable looping
                    speedAlertSound.play().catch(e => console.error("Audio play failed:", e));
                    console.log(`Speed limit (${speedLimit} km/h) exceeded. Starting continuous alert.`);
                }
                // Already speeding, sound should continue looping (handled by .loop = true)
            } else if (currentSpeedKmH <= speedLimit && isSpeeding) {
                // Speed dropped below limit
                isSpeeding = false;
                if (display.style.color === 'orange') display.style.color = '';
                speedAlertSound.loop = false; // Disable looping
                speedAlertSound.pause(); // Stop the sound
                speedAlertSound.currentTime = 0; // Reset sound position
                console.log(`Speed back below limit (${speedLimit} km/h). Stopping alert.`);
            }
        } else if (isSpeeding) {
            // Handle cases where speedLimit becomes invalid or speed drops to 0 while speeding
            isSpeeding = false;
            if (display.style.color === 'orange') display.style.color = '';
            if (speedAlertSound) {
                speedAlertSound.loop = false;
                speedAlertSound.pause();
                speedAlertSound.currentTime = 0;
                console.log("Speeding stopped due to invalid limit/speed or 0 speed.");
            }
        }
    } else if (isSpeeding) {
        // Ensure sound stops if a crash is detected while speeding
        isSpeeding = false; // Update state
        if (speedAlertSound) {
            speedAlertSound.loop = false;
            speedAlertSound.pause();
            speedAlertSound.currentTime = 0;
            console.log("Speeding alert stopped due to crash detection.");
        }
    }


    if (!crashDetected && currentSpeedMPS !== null) {
        const minSpeedBefore = parseFloat(minSpeedForCrashCheckInput.value);
        const maxSpeedAfter = parseFloat(maxSpeedAfterCrashInput.value);
        const minDecel = parseFloat(minDecelerationForCrashInput.value);
        const actualDeceleration = previousSpeedKmH - currentSpeedKmH;

        if ( previousSpeedKmH > minSpeedBefore &&
             currentSpeedKmH < maxSpeedAfter &&
             actualDeceleration >= minDecel )
        {
            console.log(`Significant Deceleration Event: Speed drop ${previousSpeedKmH.toFixed(1)} -> ${currentSpeedKmH.toFixed(1)} (Decel: ${actualDeceleration.toFixed(1)} km/h)`);
            display.style.backgroundColor = '#fdd';
            decelerationEventTimestamp = Date.now();
            checkCrashConditions();
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
    display.style.backgroundColor = '';
    if (helmetStatusDisplay) helmetStatusDisplay.style.backgroundColor = '';

    monitoringStatus.textContent = "Status: CRASH DETECTED! Processing alert...";
    monitoringStatus.style.color = "red";

    console.log("Crash conditions met (Decel + Impact within Timeout), triggering alert process.");

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
        googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`; // Correct Google Maps URL
        crashLocationDisplay.innerHTML = `Location: ${locationText} (<a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer">View Map</a>)`;
    } else {
        crashLocationDisplay.textContent = `Location: Unknown`;
    }

    const now = new Date();
    const dateOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const currentDateTime = `${now.toLocaleDateString('en-US', dateOptions)} at ${now.toLocaleTimeString('en-US', timeOptions)} (Philippine Time)`;
    let messageBody = `ALERT: Automatic Crash Detection Alert from ${userName}'s phone. Potential crash detected! ${currentDateTime} at ${locationText}. Please contact emergency services or check on them immediately.`;
    if (googleMapsUrl) {
        messageBody += `\n\nLOCATION: ${googleMapsUrl} -x-`;
    }

    console.log(`Sending SMS data to Backend API: ${smsEndpointUrl}`);
    monitoringStatus.textContent = "Status: CRASH DETECTED! Sending alert via server...";

    const payload = {
        recipients: phoneNumbers,
        message: messageBody
    };

    fetch(smsEndpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
    })
    .then(response => {
        return response.json().then(data => {
            if (!response.ok) {
                let backendErrorMessage = 'Unknown backend error';
                if (data && data.result && Array.isArray(data.result) && data.result.length > 0 && data.result[0].error) { backendErrorMessage = data.result[0].error; }
                else if (data && data.error) { backendErrorMessage = data.error; }
                else if (data && data.message) { backendErrorMessage = data.message; }
                throw new Error(`${backendErrorMessage}`);
            }
            return data;
        }).catch(parseOrLogicError => {
            if (parseOrLogicError instanceof Error && (parseOrLogicError.message.includes('Backend error') || parseOrLogicError.message.includes('PhilSMS Error') || parseOrLogicError.message.includes('validation error'))) { throw parseOrLogicError; }
            console.error("Failed to parse backend response or logic error:", parseOrLogicError);
            throw new Error(`Backend responded with status ${response.status} but failed to parse response or process error structure.`);
        });
    })
    .then(data => {
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
              monitoringStatus.textContent = `Status: Alert via Server complete.`;
              const successText = `\nServer confirmation: ${data.message || 'Alert request processed.'}`;
              crashLocationDisplay.appendChild(document.createTextNode(successText));
        }
         else {
             console.warn('Received unexpected success response format from Backend API:', data);
             throw new Error('Received unexpected success response format from Backend API.');
         }
    })
    .catch(error => {
        console.error('Error calling Backend API:', error);
        monitoringStatus.textContent = `Status: FAILED to send alert via server (${error.message}).`;
        monitoringStatus.style.color = "red";
        const errorText = `\nError: Could not send automatic alert (${error.message}). Notify contacts manually if possible.`;
        crashLocationDisplay.appendChild(document.createTextNode(errorText));
    })
    .finally(() => {
        if (testSmsBtn) {
            testSmsBtn.disabled = false;
        }
    });
}

function resetCrashDetectionState() {
    crashDetected = false;
    decelerationEventTimestamp = 0;
    impactTimestamp = 0;
    console.log("Crash detection state variables reset.");
}

function resetCrashAlert() {
    resetCrashDetectionState();
    crashAlertInfo.style.display = 'none';
    monitoringStatus.textContent = isMonitoring ? "Status: Monitoring speed..." : "Status: Idle";
    monitoringStatus.style.color = "";
    display.style.color = '';
    display.style.backgroundColor = '';
    isSpeeding = false;
    if (helmetStatusDisplay) {
        helmetStatusDisplay.style.color = '';
        helmetStatusDisplay.style.backgroundColor = '';
        if(isMonitoring) fetchHelmetStatus(); else helmetStatusDisplay.textContent = "Helmet Status: Off";
    }
    console.log("Crash alert UI reset.");
    if (!isMonitoring && watchId === null) { stopBtn.disabled = true; startBtn.disabled = false; }
    else if (isMonitoring) { monitoringStatus.textContent = "Status: Monitoring speed..."; }
    if (testSmsBtn) { testSmsBtn.disabled = false; }
}

function saveSettings() {
    const userName = userNameInput.value.trim();
    const phoneNumbersRaw = phoneNumbersInput.value.trim();
    const speedLimit = speedLimitInput.value; const minSpeed = minSpeedForCrashCheckInput.value;
    const maxSpeed = maxSpeedAfterCrashInput.value;
    const minDecel = minDecelerationForCrashInput.value;
    const crashTimeout = crashTimeoutInput.value;
    const backendUrl = backendApiUrlInput.value.trim();

    if (!userName || !phoneNumbersRaw || !speedLimit || !minSpeed || !maxSpeed || !minDecel || !crashTimeout || !backendUrl) {
        settingsStatus.textContent = "Please fill in ALL required setting fields.";
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
    if (isNaN(parseFloat(crashTimeout)) || parseFloat(crashTimeout) <= 0) {
        settingsStatus.textContent = "Crash Timeout must be a positive number.";
        settingsStatus.style.color = "red"; setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
        return;
    }

    localStorage.setItem(STORAGE_PREFIX + 'userName', userName);
    localStorage.setItem(STORAGE_PREFIX + 'phoneNumbers', phoneNumbersRaw);
    localStorage.setItem(STORAGE_PREFIX + 'speedLimit', speedLimit);
    localStorage.setItem(STORAGE_PREFIX + 'minSpeed', minSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'maxSpeed', maxSpeed);
    localStorage.setItem(STORAGE_PREFIX + 'minDecel', minDecel);
    localStorage.setItem(STORAGE_PREFIX + 'crashTimeout', crashTimeout);
    localStorage.setItem(STORAGE_PREFIX + 'backendUrl', backendUrl);

    settingsStatus.textContent = "Settings saved successfully!"; settingsStatus.style.color = "green";
    console.log("Settings saved.");
    setTimeout(() => { settingsStatus.textContent = ""; }, 3000);
}

function loadSettings() {
    userNameInput.value = localStorage.getItem(STORAGE_PREFIX + 'userName') || '';
    phoneNumbersInput.value = localStorage.getItem(STORAGE_PREFIX + 'phoneNumbers') || '';
    speedLimitInput.value = localStorage.getItem(STORAGE_PREFIX + 'speedLimit') || '60';
    minSpeedForCrashCheckInput.value = localStorage.getItem(STORAGE_PREFIX + 'minSpeed') || '30';
    maxSpeedAfterCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'maxSpeed') || '5';
    minDecelerationForCrashInput.value = localStorage.getItem(STORAGE_PREFIX + 'minDecel') || '25';
    crashTimeoutInput.value = localStorage.getItem(STORAGE_PREFIX + 'crashTimeout') || '2000';
    backendApiUrlInput.value = localStorage.getItem(STORAGE_PREFIX + 'backendUrl') || '';

    console.log("Settings loaded.");
}

function getCleanedPhoneNumbers(rawString = null) {
    const inputString = rawString === null ? phoneNumbersInput.value : rawString;
    const phRegex = /^(09\d{9}|\+639\d{9})$/;
    return inputString
        .split(',')
        .map(num => num.trim())
        .filter(num => phRegex.test(num));
}

function handleTestSmsClick() {
    if (testSmsBtn) testSmsBtn.disabled = true;
    console.log("Test SMS button clicked.");
    monitoringStatus.textContent = "Status: Initiating TEST SMS send...";
    monitoringStatus.style.color = 'var(--accent-orange)';

    const backendUrl = backendApiUrlInput.value.trim();
    const phoneNumbers = getCleanedPhoneNumbers();

    if (!backendUrl || !userNameInput.value || phoneNumbers.length === 0) {
        monitoringStatus.textContent = "Status: TEST FAILED (Missing required settings - Backend URL, Name, or Recipients).";
        monitoringStatus.style.color = "red";
        alert("Please ensure User Name, Recipients, and Backend URL are set and saved before testing SMS.");
        if (testSmsBtn) testSmsBtn.disabled = false;
        return;
    }

    crashAlertInfo.style.display = 'block';
    crashLocationDisplay.textContent = "Fetching location...";
    smsLink.style.display = 'none';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`Location fetched: Lat ${latitude}, Lon ${longitude}`);
            callBackendForSms(latitude, longitude);
        },
        (error) => {
            crashLocationDisplay.textContent = `Location: Error fetching location (${error.message})`;
            console.error("Geolocation error during test:", error);
            alert(`Could not get location (${error.message}). Proceeding without coordinates.`);
            callBackendForSms(null, null);
        },
        { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 0 }
    );
}

async function fetchHelmetStatus() {
    if (!backendApiUrlInput || !helmetStatusDisplay) { return; }

    const baseBackendUrl = backendApiUrlInput.value.trim();
    if (!baseBackendUrl) {
        if (helmetStatusDisplay.textContent !== "Helmet Status: Backend URL not set") {
             helmetStatusDisplay.textContent = "Helmet Status: Backend URL not set";
             helmetStatusDisplay.style.color = 'grey';
        }
        return;
    }

     // Reset impact background indicator on new fetch if not crashed and not already indicating error
     if (!crashDetected && helmetStatusDisplay.style.backgroundColor === 'rgb(221, 221, 255)' && helmetStatusDisplay.style.color !== 'red') {
        helmetStatusDisplay.style.backgroundColor = '';
    }

    try {
        const endpointUrl = new URL('/api/latest-impact', baseBackendUrl).toString();
        const response = await fetch(endpointUrl);

        if (!response.ok) {
            let errorMsg = `HTTP error! Status: ${response.status}`;
            if (response.status === 404) errorMsg = "Error: Helmet API endpoint not found (404)";
            else if (response.status === 500) errorMsg = "Error: Helmet server error (500)";
            throw new Error(errorMsg);
        }

        const data = await response.json();

        if (data && Array.isArray(data.impactState) && data.impactState.length === 4) {
            const impacts = data.impactState;
            const anyImpact = impacts.some(val => val === true);

            let statusText = "Helmet Status: ";
            let impactLocations = [];
            if (impacts[0]) impactLocations.push("Front"); if (impacts[1]) impactLocations.push("Back");
            if (impacts[2]) impactLocations.push("Left"); if (impacts[3]) impactLocations.push("Right");

            if (impactLocations.length > 0) {
                statusText += `Impact (${impactLocations.join(', ')})`;
                if (!crashDetected) {
                    helmetStatusDisplay.style.backgroundColor = '#ddf'; // Light blue background
                }
                helmetStatusDisplay.style.color = '';
            } else {
                statusText += "No Impact Detected";
                helmetStatusDisplay.style.color = '';
                helmetStatusDisplay.style.backgroundColor = '';
            }
            helmetStatusDisplay.textContent = statusText;


            if (!crashDetected) {
                 if (anyImpact) {
                     console.log("Impact detected on helmet via polling.");
                     impactTimestamp = Date.now();
                     checkCrashConditions();
                 }
            }

        } else {
            console.warn("Received unexpected data format from helmet backend:", data);
            helmetStatusDisplay.textContent = "Helmet Status: Invalid data received";
            helmetStatusDisplay.style.color = 'red';
            helmetStatusDisplay.style.backgroundColor = '';
        }

    } catch (error) {
        console.error('Error fetching helmet status:', error);
        let displayError = error.message;
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             displayError = 'Network Error fetching helmet status';
        }
        helmetStatusDisplay.textContent = `Helmet Status: Error (${displayError})`;
        helmetStatusDisplay.style.color = 'red';
        helmetStatusDisplay.style.backgroundColor = '';
    }
}

function checkCrashConditions() {
    if (crashDetected) { return; }

    const crashTimeout = parseFloat(crashTimeoutInput.value);
    const now = Date.now();

    if (decelerationEventTimestamp > 0 && (now - decelerationEventTimestamp > crashTimeout)) {
        console.log("Deceleration event timestamp expired.");
        decelerationEventTimestamp = 0;
        if (display.style.backgroundColor === 'rgb(255, 221, 221)') { display.style.backgroundColor = ''; }
    }
    if (impactTimestamp > 0 && (now - impactTimestamp > crashTimeout)) {
        console.log("Impact event timestamp expired.");
        impactTimestamp = 0;
        if (helmetStatusDisplay.style.backgroundColor === 'rgb(221, 221, 255)') { helmetStatusDisplay.style.backgroundColor = ''; }
    }

    if (decelerationEventTimestamp > 0 && impactTimestamp > 0) {
        const timeDifference = Math.abs(decelerationEventTimestamp - impactTimestamp);
        console.log(`Checking crash conditions: Decel time=${decelerationEventTimestamp}, Impact time=${impactTimestamp}, Diff=${timeDifference}ms, Timeout=${crashTimeout}ms`);

        if (timeDifference <= crashTimeout) {
            console.log(">>> Crash conditions MET (Deceleration + Impact within timeout) <<<");
            triggerCrashAlert();
        } else {
            console.log("Deceleration and Impact occurred, but not within the timeout window of each other.");
        }
    }
}
