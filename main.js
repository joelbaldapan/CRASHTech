let prevTimestamp = null;
let prevCoords = null;

function toKmH(metersPerSecond) {
    return (metersPerSecond * 3.6).toFixed(2); // Convert m/s to km/h
}

function updateSpeed(position) {
    const speedElement = document.getElementById("display");

    if (position.coords.speed !== null) {
        // Use direct speed from GPS if available
        speedElement.textContent = `Speed: ${toKmH(position.coords.speed)} km/h`;
    } else if (prevCoords) {
        // Calculate speed manually
        const { latitude, longitude } = position.coords;
        const timestamp = position.timestamp;

        const distance = haversineDistance(prevCoords, { latitude, longitude });
        const timeElapsed = (timestamp - prevTimestamp) / 1000; // Convert ms to seconds

        if (timeElapsed > 0) {
            const speed = distance / timeElapsed; // Speed in m/s
            speedElement.textContent = `Speed: ${toKmH(speed)} km/h (estimated)`;
        }
    }

    // Update previous values
    prevCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    prevTimestamp = position.timestamp;
}

function haversineDistance(coords1, coords2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (angle) => (angle * Math.PI) / 180;

    const dLat = toRad(coords2.latitude - coords1.latitude);
    const dLon = toRad(coords2.longitude - coords1.longitude);
    const lat1 = toRad(coords1.latitude);
    const lat2 = toRad(coords2.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

function handleError(error) {
    document.getElementById("display").textContent = "Error: " + error.message;
}

if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(updateSpeed, handleError, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000
    });
} else {
    document.getElementById("display").textContent = "Geolocation not supported.";
}