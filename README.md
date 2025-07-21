# CRASHTech - Speed & Crash Detection System

![CRASHTech Logo](https://img.shields.io/badge/ESP32-Smart%20Helmet-orange)  
⛑️💥 ESP32-Based Smart Helmet with Piezoelectric Shock Tap Sensors: Enhanced Motorcycle Safety and Emergency Assistance System via Geolocation API and PhilSMS

🎓️ A Capstone Commission Project, for Bohol Wisdom School's Research Fair

## Overview

CRASHTech is a speed-tracking and crash-detection system designed for motorcycles. It combines real-time speed monitoring, helmet impact detection, and automated SMS emergency alerts. The system uses an ESP32 microcontroller, piezoelectric sensors, a Node.js backend, and a modern web frontend.

## System Architecture

```
[ESP32 Helmet] --(WiFi/HTTP)--> [Node.js Backend] <--(REST API)--> [Frontend Web App]
         |                                                   |
   Piezo Sensors                                      PhilSMS API
```

- **ESP32**: Reads impact sensors, displays status on LCD, sends impact data to backend.
- **Backend**: Receives impact data, exposes REST API for frontend, relays SMS via PhilSMS.
- **Frontend**: Web app for monitoring, settings, and alert management.

## Getting Started

### 1. ESP32 Firmware

- Edit WiFi credentials and backend URL in [`esp32_code.c`](esp32_code.c).
- Flash code to ESP32.
- Connect helmet sensors to GPIO pins as defined in the code.

### 2. Backend Server

- Go to [`backend/`](backend/) and run:

  ```sh
  npm install
  ```

- Create a `.env` file in `backend/` with:

  ```
  PHIL_SMS_API_TOKEN=your_philsms_api_token
  PHIL_SMS_SENDER_ID=your_sender_id
  ```

- Start the server:

  ```sh
  npm start
  ```

- The backend exposes:
  - `POST /api/impact` (from ESP32)
  - `GET /api/latest-impact` (for frontend)
  - `POST /api/send-philsms` (for SMS alerts)

### 3. Frontend Web App

- Open [`index.html`](index.html) in your browser.
- Configure settings (name, contacts, speed limit, backend URL, etc.).
- Click **Start Monitoring** to begin.

## File Structure

```
.
├── esp32_code.c           # ESP32 firmware for helmet sensors
├── index.html             # Main web UI
├── main.js                # Frontend logic
├── style.css              # Web UI styles
├── Speed Alert.mp3        # Speeding alert sound
├── backend/
│   ├── server.js          # Node.js backend server
│   ├── package.json
│   └── .gitignore
└── README.md
```

---

## Configuration

- **Backend API URL:** Set to your deployed backend (e.g., `https://your-backend.onrender.com`)
- **PhilSMS:** Register at [philsms.com](https://philsms.com) for API credentials.

## Usage

1. Save your settings in the web app.
2. Start monitoring.
3. When a crash is detected (sudden deceleration + helmet impact), SMS alerts are sent automatically.
4. Use the **Test Send SMS Alert** button to verify SMS delivery.

## Credits

- ESP32, Node.js, Express, PhilSMS, Google Maps, and open web APIs.
