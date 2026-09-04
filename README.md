# Rudermesser (Arduino Nano 33 BLE)

Misst den Ruderausschlag eines Modellflugzeugs in Millimetern und zeigt ihn live auf dem Smartphone an.

## Funktionsweise

Ein Arduino Nano 33 BLE wird an das Ruder geklemmt. Der eingebaute IMU-Sensor (LSM9DS1) misst den Winkel der Ruderbewegung. Dieser wird über die Hebelarm-Länge in Millimeter Ausschlag umgerechnet und per Bluetooth (BLE) an eine Web-App gesendet.

## Berechnung

```
mm Ausschlag = sin(Winkel) × (Hebelarm + 23 mm)
```

- **23 mm** = fester Offset (Vorderkante Gehäuse bis IMU-Chip Mitte)
- **Hebelarm** = Abstand Scharnierachse bis Gehäusevorderkante (in der App einstellbar)

## Bedienung

1. Arduino ans Ruder montieren und mit Strom versorgen (1S LiPo an 3.3V/GND)
2. Web-App öffnen (PWA, über Chrome auf Android)
3. "Verbinden" drücken und "Rudermesser" auswählen
4. Ruder in Neutralstellung → "Nullpunkt setzen"
5. Hebelarm eingeben → "Senden"
6. Ruder bewegen → Ausschlag in mm ablesen

## Projektstruktur

```
Rudder Messen/
├── platformio.ini     PlatformIO Konfiguration (Board, Bibliotheken)
├── src/
│   └── main.cpp       Arduino Firmware (IMU auslesen, BLE senden)
└── webapp/            Web-App (PWA)
    ├── index.html
    ├── style.css
    ├── app.js
    ├── manifest.json
    ├── service-worker.js
    └── icon-192.png / icon-512.png
```

## Hardware

- Arduino Nano 33 BLE
- 1S LiPo Akku (z.B. 500 mAh) an 3.3V / GND

## Software / Bibliotheken

- Arduino_LSM9DS1 (IMU)
- ArduinoBLE (Bluetooth)

## Web-App

Die Web-App läuft als PWA (Progressive Web App) und funktioniert offline.
Gehostet über GitHub Pages.

## Hinweis

Web Bluetooth funktioniert nur in Chrome auf Android, nicht auf iOS.
Für eine plattformunabhängige Lösung siehe das Schwesterprojekt "Rudder Messen ESP32" (WLAN statt Bluetooth).
