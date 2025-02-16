const output = document.getElementById("display");
const highAccuracyCheckbox = document.getElementById("highAccuracyCheckbox");
const timeoutInput = document.getElementById("timeoutInput");
const applySettingsButton = document.getElementById("applySettings");

let reqcount = 0;
let watchID = null;

function startTracking() {
    if (watchID) {
        navigator.geolocation.clearWatch(watchID); // Clear existing watcher
    }

    const options = {
        enableHighAccuracy: highAccuracyCheckbox.checked,
        timeout: parseInt(timeoutInput.value),
        maximumAge: 0
    };

    watchID = navigator.geolocation.watchPosition(successCallback, errorCallback, options);
}

// setInterval(() => {
//     navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options);
// }, 1000);  // Requests every second

function successCallback(position) {
    reqcount++;
    const { accuracy, latitude, longitude, altitude, heading, speed } = position.coords;

    output.innerHTML = 
        "ReqCount: " + reqcount + "<br>" +
        "Accuracy: " + accuracy + " meters<br>" +
        "Latitude: " + latitude + "<br>" +
        "Longitude: " + longitude + "<br>" +
        "Altitude: " + (altitude !== null ? altitude + " meters" : "Not available") + "<br>" +
        "Heading: " + (heading !== null ? heading + "°" : "Not available") + "<br>" +
        "Speed: " + (speed !== null ? speed + " m/s" : "Not available");
}

function errorCallback(error) {
    console.error("Geolocation error:", error.message);
}

// Apply settings when the button is clicked
applySettingsButton.addEventListener("click", startTracking);

// Start tracking with default settings
startTracking();
