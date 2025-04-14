#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Wifi.h>              // for Wifi
#include <HTTPClient.h>        // for HTTP requests

// --- Sensor and LCD setup ---
// Sensor pin definitions
#define SENSOR1 2   // Front
#define SENSOR2 4   // Back
#define SENSOR3 17  // Left
#define SENSOR4 19  // Right

// Custom I2C pins for ESP32
#define I2C_SDA 8
#define I2C_SCL 9
LiquidCrystal_I2C lcd(0x27, 16, 2);

// --- Wifi Deets ---
const char* ssid = "YOUR_MOBILE_HOTSPOT_NAME";
const char* password = "YOUR_MOBILE_HOTSPOT_PASSWORD";

// --- Backend Server Deets ---
String serverUrl = "http://your-render-app-name.onrender.com/api/impact";

// --- State variables ---
unsigned long lastImpactTime = 0;
String currentMessage = "No Tap Detected"; // For LCD display
bool impactActive = false;                 // For LCD display timing

// we'll send an array to the back end server corresponding to the four sensors
bool currentSensorState[4] = {false, false, false, false}; // [Front, Back, Left, Right]
bool lastSentSensorState[4] = {false, false, false, false}; // track last state sent to server

// --- Function to connect to Wifi ---
void setupWifi() {
    delay(10);
    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Connecting Wifi");

    Wifi.begin(ssid, password);

    while (Wifi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    if (Wifi.status() == WL_CONNECTED) {
        Serial.println("");
        Serial.println("Wifi connected");
        Serial.print("IP address: ");
        Serial.println(Wifi.localIP());
        lcd.setCursor(0, 1);
        lcd.print("Wifi Connected!");
        delay(1000);
    } else {
        Serial.println("Failed to connect to Wifi");
        lcd.setCursor(0, 1);
        lcd.print("Wifi Failed!");
        delay(1000);
    }
}

// --- Function to check if sensor state has changed ---
bool stateChanged(bool currentState[4], bool lastState[4]) {
    for (int i = 0; i < 4; i++) {
        if (currentState[i] != lastState[i]) {
            return true; // State has changed
        }
    }
    return false; // State is the same
}

// --- Function to send data array to BACKEND SERVER AT RENDER ---
void sendDataToServer(bool sensorState[4]) {
    if (Wifi.status() == WL_CONNECTED) {
        HTTPClient http;

        // Construct JSON payload as a boolean array string
        String jsonPayload = "[";
        jsonPayload += sensorState[0] ? "true" : "false";
        jsonPayload += ",";
        jsonPayload += sensorState[1] ? "true" : "false";
        jsonPayload += ",";
        jsonPayload += sensorState[2] ? "true" : "false";
        jsonPayload += ",";
        jsonPayload += sensorState[3] ? "true" : "false";
        jsonPayload += "]";

        Serial.print("Sending data array to server: ");
        Serial.println(jsonPayload);

        http.begin(serverUrl); // Specify the URL
        http.addHeader("Content-Type", "application/json"); // Specify content type

        int httpResponseCode = http.POST(jsonPayload); // Send POST request

        if (httpResponseCode > 0) {
            Serial.print("HTTP Response code: ");
            Serial.println(httpResponseCode);
        } else {
            Serial.print("Error sending POST: ");
            Serial.println(httpResponseCode);
        }

        http.end(); // Free resources

    } else {
        Serial.println("Wifi not connected. Cannot send data.");
        // Attempt to reconnect if not connected during send attempt
        setupWifi();
    }
}


void setup() {
    Serial.begin(115200);

    pinMode(SENSOR1, INPUT);
    pinMode(SENSOR2, INPUT);
    pinMode(SENSOR3, INPUT);
    pinMode(SENSOR4, INPUT);

    Wire.begin(I2C_SDA, I2C_SCL);
    lcd.begin(16, 2);
    lcd.backlight();

    lcd.setCursor(0, 0);
    lcd.print("Helmet System");
    lcd.setCursor(0, 1);
    lcd.print("Initializing...");
    Serial.println("Helmet System - Initializing...");
    delay(1000);

    setupWifi(); // Connect to Wifi

    // Initialize sensor states (init to false, since we assume theres no impact)
    for(int i=0; i<4; i++) {
        currentSensorState[i] = false;
        lastSentSensorState[i] = false;
    }

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("No Tap Detected");
    Serial.println("No Tap Detected");
    currentMessage = "No Tap Detected"; // Initial LCD message
}

void loop() {
    // --- Read all sensors into the current state array ---
    currentSensorState[0] = digitalRead(SENSOR1); // Front
    currentSensorState[1] = digitalRead(SENSOR2); // Back
    currentSensorState[2] = digitalRead(SENSOR3); // Left
    currentSensorState[3] = digitalRead(SENSOR4); // Right

    // --- Check if the sensor state has changed since the last time we sent data ---
    if (stateChanged(currentSensorState, lastSentSensorState)) {
        sendDataToServer(currentSensorState); // Send the new state array
        // Update the last sent state *after* sending
        // we do this so we don't send duplicates
        for (int i = 0; i < 4; i++) {
            lastSentSensorState[i] = currentSensorState[i];
        }
    }

    // --- Determine LCD message based on current sensor state ---
    String newMessage = "";
    bool anySensorTriggered = false;
    if (currentSensorState[0]) {
        newMessage = "Impact: Front";
        anySensorTriggered = true;
    } else if (currentSensorState[1]) {
        newMessage = "Impact: Back";
        anySensorTriggered = true;
    } else if (currentSensorState[2]) {
        newMessage = "Impact: Left";
        anySensorTriggered = true;
    } else if (currentSensorState[3]) {
        newMessage = "Impact: Right";
        anySensorTriggered = true;
    }

    unsigned long currentMillis = millis();

    // --- LCD Update Logic ---
    if (anySensorTriggered) {
        // Show impact message immediately and update LCD if it's different
        if (newMessage != currentMessage) {
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print(newMessage);
            Serial.println("LCD Update: " + newMessage); // for serial
            currentMessage = newMessage;
        }
        lastImpactTime = currentMillis;
        impactActive = true;
    } else if (impactActive && currentMillis - lastImpactTime >= 3000) {
        // After 3 seconds of no detection, reset LCD to default
        newMessage = "No Tap Detected";
        if (newMessage != currentMessage) {
                lcd.clear();
                lcd.setCursor(0, 0);
                lcd.print(newMessage);
                Serial.println("LCD Update: " + newMessage);
                currentMessage = newMessage;
        }
        impactActive = false;
    }

    // Check Wifi connection everytime the loop happens
    // And we attempt reconnect if needed
    if (Wifi.status() != WL_CONNECTED) {
        Serial.println("Wifi disconnected. Attempting reconnect...");
        setupWifi();
        lastWifiCheck = millis();
    }


    delay(50); // Responsive loop
}