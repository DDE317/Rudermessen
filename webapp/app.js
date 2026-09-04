// ── Service Worker registrieren (PWA / Offline) ──────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .catch(err => console.warn('SW Fehler:', err));
}

// ── BLE UUIDs (müssen mit Arduino übereinstimmen) ────────────────────────────
const SERVICE_UUID    = '12345678-1234-1234-1234-123456789abc';
const ANGLE_UUID      = '12345678-1234-1234-1234-123456789abd';
const DEFLECTION_UUID = '12345678-1234-1234-1234-123456789abe';
const LEVER_ARM_UUID  = '12345678-1234-1234-1234-123456789abf';
const CALIBRATE_UUID  = '12345678-1234-1234-1234-123456789ac0';

const CHIP_OFFSET_MM  = 23;

// ── UI-Elemente ──────────────────────────────────────────────────────────────
const connectBtn      = document.getElementById('connectBtn');
const statusDot       = document.getElementById('statusDot');
const statusText      = document.getElementById('statusText');
const deflectionValue = document.getElementById('deflectionValue');
const angleValue      = document.getElementById('angleValue');
const arrowFill       = document.getElementById('arrowFill');
const resetBtn        = document.getElementById('resetBtn');
const leverInput      = document.getElementById('leverInput');
const sendLeverBtn    = document.getElementById('sendLeverBtn');
const totalLeverSpan  = document.getElementById('totalLever');

// SVG-Elemente
const rudderGroup     = document.getElementById('rudderGroup');
const anglePath       = document.getElementById('anglePath');
const angleLabel      = document.getElementById('angleLabel');

// ── BLE Handles ──────────────────────────────────────────────────────────────
let bleDevice     = null;
let leverArmChar  = null;
let calibrateChar = null;

// ── Hebelarm-Anzeige live aktualisieren ──────────────────────────────────────
leverInput.addEventListener('input', updateTotalLever);

function updateTotalLever() {
    const v = parseFloat(leverInput.value) || 0;
    totalLeverSpan.textContent = (v + CHIP_OFFSET_MM).toFixed(1);
}
updateTotalLever();

// ── BLE Verbinden / Trennen ──────────────────────────────────────────────────
connectBtn.addEventListener('click', async () => {
    if (bleDevice && bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
        return;
    }

    if (!navigator.bluetooth) {
        alert('Web Bluetooth wird nicht unterstützt.\nBitte Chrome auf Android verwenden.');
        return;
    }

    try {
        setStatus('connecting');

        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'Rudermesser' }],
            optionalServices: [SERVICE_UUID]
        });

        bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

        const server  = await bleDevice.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);

        const angleCharBLE      = await service.getCharacteristic(ANGLE_UUID);
        const deflectionCharBLE = await service.getCharacteristic(DEFLECTION_UUID);
        leverArmChar            = await service.getCharacteristic(LEVER_ARM_UUID);
        calibrateChar           = await service.getCharacteristic(CALIBRATE_UUID);

        // Notifications aktivieren
        await angleCharBLE.startNotifications();
        angleCharBLE.addEventListener('characteristicvaluechanged', onAngleChanged);

        await deflectionCharBLE.startNotifications();
        deflectionCharBLE.addEventListener('characteristicvaluechanged', onDeflectionChanged);

        // Gespeicherten Hebelarm laden
        const leverVal    = await leverArmChar.readValue();
        const storedLever = leverVal.getInt32(0, true) / 10.0;
        leverInput.value  = storedLever;
        updateTotalLever();

        setStatus('connected');

    } catch (err) {
        console.error(err);
        setStatus('disconnected');
        if (err.name !== 'NotFoundError') {
            alert('Verbindungsfehler: ' + err.message);
        }
    }
});

// ── RESET / Nullpunkt setzen ─────────────────────────────────────────────────
resetBtn.addEventListener('click', async () => {
    if (!calibrateChar) return;

    try {
        await calibrateChar.writeValue(new Uint8Array([1]));
        flashBtn(resetBtn, '✓ Nullpunkt gesetzt!', 1800);
    } catch (err) {
        alert('Fehler beim Reset: ' + err.message);
    }
});

// ── Hebelarm senden ──────────────────────────────────────────────────────────
sendLeverBtn.addEventListener('click', async () => {
    if (!leverArmChar) return;
    const mm  = parseFloat(leverInput.value) || 0;
    const val = Math.round(mm * 10);
    const buf = new Int32Array([val]).buffer;
    try {
        await leverArmChar.writeValue(buf);
        flashBtn(sendLeverBtn, '✓ Gesendet', 1500);
    } catch (err) {
        alert('Fehler: ' + err.message);
    }
});

// ── BLE Callbacks ────────────────────────────────────────────────────────────
function onAngleChanged(event) {
    const raw   = event.target.value.getInt32(0, true);
    const angle = raw / 100.0;
    angleValue.textContent = angle.toFixed(1);
    updateRudderGraphic(angle);
}

function onDeflectionChanged(event) {
    const raw        = event.target.value.getInt32(0, true);
    const deflection = raw / 10.0;
    deflectionValue.textContent = deflection.toFixed(1);
    updateArrowBar(deflection);
    updateDeflectionColor(deflection);
}

function onDisconnected() {
    setStatus('disconnected');
    leverArmChar  = null;
    calibrateChar = null;
    deflectionValue.textContent = '--';
    angleValue.textContent      = '--';
    updateRudderGraphic(0);
    updateArrowBar(0);
}

// ── Grafische Ruderanzeige ────────────────────────────────────────────────────
// SVG: Scharnierachse bei cx=150, cy=110
// rudderGroup dreht sich um diesen Punkt

function updateRudderGraphic(angleDeg) {
    // Ruder dreht sich um Scharnierachse (150, 110)
    rudderGroup.setAttribute('transform', `rotate(${angleDeg}, 150, 110)`);

    // Winkel-Label
    angleLabel.textContent = angleDeg.toFixed(1) + '°';

    // Winkel-Bogen zeichnen
    if (Math.abs(angleDeg) > 0.5) {
        const r      = 40;
        const cx     = 150, cy = 110;
        const x1     = cx + r;  // Startpunkt bei 0° (rechts)
        const y1     = cy;
        const endRad = angleDeg * Math.PI / 180;
        const x2     = cx + r * Math.cos(endRad);
        const y2     = cy + r * Math.sin(endRad);

        const largeArc = Math.abs(angleDeg) > 180 ? 1 : 0;
        const sweep    = angleDeg > 0 ? 1 : 0;

        anglePath.setAttribute('d',
            `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`
        );

        // Label neben dem Bogen
        const midRad = endRad / 2;
        const lx = cx + (r + 18) * Math.cos(midRad);
        const ly = cy + (r + 18) * Math.sin(midRad);
        angleLabel.setAttribute('x', lx);
        angleLabel.setAttribute('y', ly);
    } else {
        anglePath.setAttribute('d', '');
        angleLabel.setAttribute('x', 195);
        angleLabel.setAttribute('y', 90);
    }
}

// ── Richtungsbalken ───────────────────────────────────────────────────────────
function updateArrowBar(deflection_mm) {
    const maxMm   = 30;
    const clamped = Math.max(-maxMm, Math.min(maxMm, deflection_mm));
    const pct     = clamped / maxMm; // -1 … +1

    if (pct >= 0) {
        arrowFill.style.left  = '50%';
        arrowFill.style.width = (pct * 50) + '%';
    } else {
        arrowFill.style.left  = (50 + pct * 50) + '%';
        arrowFill.style.width = (-pct * 50) + '%';
    }
}

// ── Farbe des Ausschlags je nach Betrag ──────────────────────────────────────
function updateDeflectionColor(deflection_mm) {
    const abs = Math.abs(deflection_mm);
    let color, barColor;

    if (abs < 5) {
        color    = 'var(--green)';
        barColor = 'var(--green)';
    } else if (abs < 15) {
        color    = 'var(--accent)';
        barColor = 'var(--accent)';
    } else if (abs < 25) {
        color    = 'var(--yellow)';
        barColor = 'var(--yellow)';
    } else {
        color    = 'var(--red)';
        barColor = 'var(--red)';
    }

    deflectionValue.style.color = color;
    arrowFill.style.background  = barColor;
}

// ── Status setzen ────────────────────────────────────────────────────────────
function setStatus(state) {
    statusDot.className = 'status-dot ' + state;

    if (state === 'connected') {
        statusText.textContent  = 'Verbunden';
        connectBtn.textContent  = 'Trennen';
        resetBtn.disabled       = false;
        sendLeverBtn.disabled   = false;
    } else if (state === 'connecting') {
        statusText.textContent  = 'Verbinde...';
        connectBtn.textContent  = 'Abbrechen';
        resetBtn.disabled       = true;
        sendLeverBtn.disabled   = true;
    } else {
        statusText.textContent  = 'Nicht verbunden';
        connectBtn.textContent  = 'Verbinden';
        resetBtn.disabled       = true;
        sendLeverBtn.disabled   = true;
    }
}

// ── Button-Flash Feedback ────────────────────────────────────────────────────
function flashBtn(btn, msg, duration) {
    const orig = btn.textContent;
    btn.textContent = msg;
    btn.disabled    = true;
    setTimeout(() => {
        btn.textContent = orig;
        btn.disabled    = false;
    }, duration);
}

// ── Init ─────────────────────────────────────────────────────────────────────
setStatus('disconnected');
updateRudderGraphic(0);
