let prevTimestamp = null;
let prevCoords = null;
let watchId = null; // Stores the tracking ID

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const display = document.getElementById("display");
const speedLog = document.getElementById("speedLog");

const ACCURACY = true;
const MAXIMUM_AGE = 1000;
const TIMEOUT = 5000;

function toKmH(metersPerSecond) {
    return (metersPerSecond * 3.6).toFixed(2);
}

function updateSpeed(position) {
    if (!watchId) return; // Stops updating if tracking is stopped

    const currentTime = new Date().toLocaleTimeString();
    let speed = position.coords.speed;
    let estimated = false;

    if (speed === null && prevCoords) {
        const { latitude, longitude } = position.coords;
        const timestamp = position.timestamp;
        const distance = haversineDistance(prevCoords, { latitude, longitude });
        const timeElapsed = (timestamp - prevTimestamp) / 1000;

        if (timeElapsed > 0) {
            speed = distance / timeElapsed;
            estimated = true;
        }
    }

    if (speed !== null) {
        const speedKmH = toKmH(speed);
        display.textContent = `Speed: ${speedKmH} km/h ${estimated ? "(estimated)" : ""}`;

        // ✅ Append speed log
        const listItem = document.createElement("li");
        listItem.textContent = `${currentTime} - ${speedKmH} km/h`;
        speedLog.appendChild(listItem);
    }

    prevCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    prevTimestamp = position.timestamp;
}

function haversineDistance(coords1, coords2) {
    const R = 6371000;
    const toRad = (angle) => (angle * Math.PI) / 180;

    const dLat = toRad(coords2.latitude - coords1.latitude);
    const dLon = toRad(coords2.longitude - coords1.longitude);
    const lat1 = toRad(coords1.latitude);
    const lat2 = toRad(coords2.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function handleError(error) {
    display.textContent = "Error: " + error.message;
}

// ✅ Start button - Clears log and starts tracking
startBtn.addEventListener("click", () => {
    if (watchId) return; // Prevents multiple watchers

    speedLog.innerHTML = ""; // ✅ Clears previous log
    display.textContent = "Starting tracking...";

    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(updateSpeed, handleError, {
            enableHighAccuracy: ACCURACY,
            maximumAge: MAXIMUM_AGE,
            timeout: TIMEOUT
        });
    } else {
        display.textContent = "Geolocation not supported.";
    }
});

// ✅ Stop button - Stops tracking
stopBtn.addEventListener("click", () => {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null; // ✅ Stops tracking updates
        display.textContent = "Tracking stopped.";
    }
});
