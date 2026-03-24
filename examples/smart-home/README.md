# Smart Home Ranch Template

A multi-agent Ranch for home automation, IoT control, and GPIO orchestration on Jetson hardware.

---

## What This Ranch Does

The Smart Home Ranch uses agents to observe, reason about, and control your home environment. Unlike rule-based automation (Home Assistant, Node-RED), Ranch agents learn your patterns and make decisions based on context — not just if/then rules.

```
Sensor Data (GPIO / MQTT / HTTP)
       |
  [Observer]     ← monitors sensors, detects anomalies, recognizes patterns
       |
  [Reasoner]     ← interprets sensor context, infers intent and state
       |
  [Controller]   ← decides actions, respects safety constraints
       |
  [Logger]       ← records events, builds Memory Pasture for pattern learning
       |
  Actuator Commands (GPIO / MQTT / HTTP)
```

After Night School, the Observer and Reasoner agents learn your household's patterns: when lights are typically on, when rooms are occupied, what temperature ranges you prefer at different times of day — without any explicit programming.

---

## Example Capabilities

### Adaptive Lighting

The Observer notices that living room lights are turned off within 20 minutes of the TV being turned on. After 2 weeks of Night School, the Controller learns to automatically dim the lights when the TV signal appears on the network — before you even reach for the switch.

### Anomaly Detection

The Observer tracks typical appliance power draw from smart plugs. When the refrigerator compressor runs 40% longer than usual (potential failure indicator), the Reasoner flags it and the Logger writes an alert to the Memory Pasture. You receive a notification before the fridge fails.

### Context-Aware HVAC

The Reasoner combines: time of day, calendar events (home/away), outdoor temperature (from web API), and occupancy (motion sensors) to make HVAC decisions. Unlike a thermostat schedule, it adapts to irregular patterns — works from home days, guests, seasons.

---

## Hardware Requirements

- Jetson Orin Nano (or any Linux + CUDA GPU)
- GPIO access (Jetson 40-pin header, or USB GPIO boards like FT232H)
- Optional: MQTT broker (Mosquitto) for IoT devices
- Optional: Home Assistant for device integration layer

---

## Quick Setup

```bash
bash examples/smart-home/setup.sh
```

The setup script installs the smart-home herd and optionally configures MQTT integration.

---

## GPIO Integration

The Controller agent can issue GPIO commands via the Ranch GPIO bridge:

```bash
# Install GPIO bridge (Jetson-specific)
pip3 install Jetson.GPIO

# Enable GPIO permissions
sudo groupadd -f -r gpio
sudo usermod -a -G gpio $USER
sudo cp /opt/nvidia/jetson-gpio/etc/99-gpio.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Then in `.env`:
```bash
GPIO_ENABLED="true"
GPIO_BRIDGE_PORT="8765"  # WebSocket port for Ranch→GPIO bridge
```

---

## MQTT Integration

For homes with existing MQTT-based IoT devices (Zigbee, Z-Wave via integrations):

```bash
# .env additions
MQTT_BROKER="mqtt://localhost:1883"
MQTT_TOPIC_PREFIX="ranch/home"
```

The Observer agent subscribes to MQTT topics and writes sensor readings to the Memory Pasture. The Controller publishes commands to MQTT.

---

## Safety Constraints

The Controller agent always checks a safety constraint list before issuing actuator commands. Edit `examples/smart-home/safety.json` to define constraints:

```json
{
  "never": [
    "turn off smoke detector",
    "disable fire alarm",
    "unlock doors between 11pm and 6am"
  ],
  "require_confirmation": [
    "adjust thermostat by more than 5 degrees",
    "turn off all lights"
  ]
}
```

These constraints are hard-coded into the Controller's system prompt and are **not modified by Night School breeding**.

---

## Breed File

See [breed.md](breed.md) for recipes to develop a Home Intelligence agent.
