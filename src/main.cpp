/*
 * Rudermesser - Arduino Nano 33 BLE
 * 
 * Misst den Ruderausschlag über den eingebauten IMU (LSM9DS1)
 * und sendet die Daten per BLE an eine Web-App.
 * 
 * Einbaulage: Arduino um 180° gedreht (USB hinten)
 * Fester Offset: 23mm (Vorderkante Gehäuse bis IMU-Chip Mitte)
 */

#include <Arduino_LSM9DS1.h>
#include <ArduinoBLE.h>

// ── Fester Hardware-Offset ──────────────────────────────────────────────────
const float CHIP_OFFSET_MM = 23.0f;

// ── BLE Service & Characteristics ───────────────────────────────────────────
BLEService rudermesserService("12345678-1234-1234-1234-123456789ABC");

// Senden: aktueller Winkel in 0.01° (int16) und Ausschlag in 0.1mm (int16)
BLEIntCharacteristic angleChar(
    "12345678-1234-1234-1234-123456789ABD",
    BLERead | BLENotify
);
BLEIntCharacteristic deflectionChar(
    "12345678-1234-1234-1234-123456789ABE",
    BLERead | BLENotify
);

// Empfangen: Hebelarm (Abstand Scharnier → Gehäusevorderkante) in mm (*10 als int)
BLEIntCharacteristic leverArmChar(
    "12345678-1234-1234-1234-123456789ABF",
    BLERead | BLEWrite
);

// Empfangen: Nullpunkt-Befehl (1 = kalibrieren)
BLEByteCharacteristic calibrateChar(
    "12345678-1234-1234-1234-123456789AC0",
    BLERead | BLEWrite
);

// ── Globale Variablen ────────────────────────────────────────────────────────
float zeroAngle   = 0.0f;   // Nullpunkt-Winkel
float leverArm_mm = 50.0f;  // Standard-Hebelarm in mm (einstellbar per App)
float filteredAngle = 0.0f; // Geglätteter Winkel

// Tiefpassfilter - je kleiner der Wert desto ruhiger (0.0-1.0)
// 0.1 = sehr ruhig/träge, 0.3 = ausgewogen, 0.5 = schnell
const float FILTER_ALPHA = 0.15f;

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 50; // 20 Hz

// ── Hilfsfunktion: Winkel aus Beschleunigungssensor ─────────────────────────
float getAngle() {
    float ax, ay, az;
    if (!IMU.accelerationAvailable()) return 0.0f;
    IMU.readAcceleration(ax, ay, az);

    // 180° Korrektur für umgekehrten Einbau (USB hinten): X und Z invertieren
    ax = -ax;
    az = -az;

    // Winkel um die Querachse (rauf/runter Bewegung = Ruderausschlag)
    // ax = Längsachse, az = Hochachse → misst Neigung rauf/runter
    float angle = atan2(ax, az) * 180.0f / PI;
    return angle;
}

// ── Setup ────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(1000);

    // IMU initialisieren
    if (!IMU.begin()) {
        Serial.println("IMU Fehler!");
        while (1);
    }
    Serial.println("IMU OK");

    // BLE initialisieren
    if (!BLE.begin()) {
        Serial.println("BLE Fehler!");
        while (1);
    }

    BLE.setLocalName("Rudermesser");
    BLE.setAdvertisedService(rudermesserService);

    rudermesserService.addCharacteristic(angleChar);
    rudermesserService.addCharacteristic(deflectionChar);
    rudermesserService.addCharacteristic(leverArmChar);
    rudermesserService.addCharacteristic(calibrateChar);

    BLE.addService(rudermesserService);

    // Standardwerte setzen
    angleChar.writeValue(0);
    deflectionChar.writeValue(0);
    leverArmChar.writeValue((int)(leverArm_mm * 10));
    calibrateChar.writeValue(0);

    BLE.advertise();
    Serial.println("BLE bereit - suche nach Verbindung...");
}

// ── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
    BLEDevice central = BLE.central();

    if (central) {
        Serial.print("Verbunden mit: ");
        Serial.println(central.address());

        while (central.connected()) {

            // ── Einstellungen von App empfangen ──────────────────────────
            if (leverArmChar.written()) {
                leverArm_mm = leverArmChar.value() / 10.0f;
                Serial.print("Neuer Hebelarm: ");
                Serial.print(leverArm_mm);
                Serial.println(" mm");
            }

            if (calibrateChar.written() && calibrateChar.value() == 1) {
                zeroAngle = getAngle();
                filteredAngle = 0.0f; // Filter sofort auf Null setzen
                calibrateChar.writeValue(0);
                Serial.print("Nullpunkt gesetzt: ");
                Serial.print(zeroAngle);
                Serial.println("°");
            }

            // ── Messung senden ────────────────────────────────────────────
            if (millis() - lastSend >= SEND_INTERVAL_MS) {
                lastSend = millis();

                float rawAngle   = getAngle();
                float angle      = rawAngle - zeroAngle;

                // Winkel auf -180 bis +180 normalisieren
                while (angle > 180.0f)  angle -= 360.0f;
                while (angle < -180.0f) angle += 360.0f;

                // Tiefpassfilter anwenden
                filteredAngle = FILTER_ALPHA * angle + (1.0f - FILTER_ALPHA) * filteredAngle;

                float totalLever = leverArm_mm + CHIP_OFFSET_MM;
                float deflection = sin(filteredAngle * PI / 180.0f) * totalLever;

                // Winkel in 0.01° senden, Ausschlag in 0.1mm
                angleChar.writeValue((int)(filteredAngle * 100));
                deflectionChar.writeValue((int)(deflection * 10));

                // Debug-Ausgabe
                Serial.print("Winkel: ");
                Serial.print(filteredAngle, 2);
                Serial.print("°  Ausschlag: ");
                Serial.print(deflection, 1);
                Serial.println(" mm");
            }
        }

        Serial.println("Verbindung getrennt");
    }
}
