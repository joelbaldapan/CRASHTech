const output = document.getElementById("display");
let reqcount = 0;

const options = {
    enableHighAccuracy: true,  // Request highest accuracy
    timeout: 1000,             // Lower timeout for faster requests
    maximumAge: 0              // No cached positions
};

// Function to continuously watch position updates
navigator.geolocation.watchPosition(successCallback, errorCallback, options);
// setInterval(() => {
//     navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options);
// }, 1000);  // Requests every second


function successCallback(position) {
    reqcount++;
    const { accuracy, latitude, longitude, altitude, heading, speed } = position.coords;

    output.innerHTML = 
        "ReqCount: " + reqcount + "<br>" +
        "Accuracy: " + accuracy + "%<br>" +
        "Latitude: " + latitude + "<br>" +
        "Longitude: " + longitude + "<br>" +
        "Altitude: " + (altitude !== null ? altitude + " meters" : "Not available") + "<br>" +
        "Heading: " + (heading !== null ? heading + "°" : "Not available") + "<br>" +
        "Speed: " + (speed !== null ? speed + " m/s" : "Not available");
}

function errorCallback(error) {
    console.error("Geolocation error:", error.message);
}
