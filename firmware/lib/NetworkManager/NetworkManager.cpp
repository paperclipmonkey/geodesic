#include "NetworkManager.h"

NetworkManager::NetworkManager()
    : _myNodeId(0), _userOnMessage(nullptr), _rxIndex(0), _receiving(false),
      _escaped(false) {
  _rs485 = &Serial2;
}

void NetworkManager::begin(uint8_t myNodeId) {
  _myNodeId = myNodeId;

  // Setup RS485 Control Pin
  pinMode(PIN_RS485_DE, OUTPUT);
  digitalWrite(PIN_RS485_DE, LOW); // Listen Mode

  // Setup Serial
  _rs485->begin(115200, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);

  Serial.printf("RS485 Initialized. Node ID: %d\n", _myNodeId);
}

void NetworkManager::update() {
  // Read incoming bytes
  while (_rs485->available()) {
    uint8_t b = _rs485->read();

    if (_escaped) {
      if (_receiving) {
        if (_rxIndex < sizeof(_rxBuffer)) {
          _rxBuffer[_rxIndex++] = b;
        } else {
          _receiving = false;
          _rxIndex = 0;
        }
      }
      _escaped = false;
      continue;
    }

    if (b == PROTOCOL_ESC) {
      _escaped = true;
      continue;
    }

    if (b == PROTOCOL_STX) {
      _receiving = true;
      _rxIndex = 0;
      _escaped = false;
      continue; // Don't store STX
    }

    if (_receiving) {
      if (b == PROTOCOL_ETX) {
        // End of Packet
        processPacket(_rxBuffer, _rxIndex);
        _receiving = false;
        _rxIndex = 0;
      } else {
        if (_rxIndex < sizeof(_rxBuffer)) {
          _rxBuffer[_rxIndex++] = b;
        } else {
          // Overflow, reset
          _receiving = false;
          _rxIndex = 0;
        }
      }
    }
  }
}

void NetworkManager::processPacket(const uint8_t *data, uint8_t len) {
  // Min size = LEN(1) + PAYLOAD(min1) + CRC(1) = 3
  if (len < 3)
    return;

  uint8_t payloadLen = data[0];
  if (payloadLen != sizeof(PacketPayload))
    return; // Simple check

  // Check CRC (Last byte before ETX, which is not in buffer)
  // Buffer: [LEN][PAYLOAD...][CRC]
  uint8_t receivedCRC = data[len - 1];
  uint8_t calculatedCRC = calculateCRC(data, len - 1);

  if (receivedCRC == calculatedCRC) {
    PacketPayload pkt;
    memcpy(&pkt, &data[1], sizeof(PacketPayload));
    processAppMessage(pkt);
  } else {
    Serial.println("CRC Error");
  }
}

void NetworkManager::processAppMessage(const PacketPayload &pkt) {
  // Filter: Is this for me OR Broadcast (0)?
  // Note: If msgType is POLL, it targets specific ID.
  // If msgType is SET_COLOR, it might be Broadcast (0) or specific.
  bool targetIsMe = (pkt.nodeId == _myNodeId);
  bool isBroadcast = (pkt.nodeId == BROADCAST_ID);

  if (targetIsMe || isBroadcast) {
    // Forward to Main
    if (_userOnMessage != nullptr) {
      _userOnMessage(pkt);
    }

    // Reply to POLL
    if (pkt.msgType == MSG_POLL && targetIsMe) {
      // Heartbeat / Ack
      // TODO: In full implementation, send any queued status
      // For now, silent ACK or separate reply logic
    }
  }
}

void NetworkManager::sendPacket(const PacketPayload &pkt) {
  // Serialize
  // [STX][LEN][PAYLOAD...][CRC][ETX]

  uint8_t len = sizeof(PacketPayload);
  uint8_t buffer[len + 3]; // LEN, PAYLOAD, CRC

  buffer[0] = len;
  memcpy(&buffer[1], &pkt, len);
  buffer[len + 1] = calculateCRC(buffer, len + 1); // CRC includes LEN + PAYLOAD

  // Switch to TX Mode
  digitalWrite(PIN_RS485_DE, HIGH);
  delayMicroseconds(50); // Driver stabilization

  _rs485->write(PROTOCOL_STX);

  // Send buffer with Escaping
  // Buffer size is len+2 (LEN, PAYLOAD..., CRC)
  for (uint8_t i = 0; i < len + 2; i++) {
    uint8_t b = buffer[i];
    if (b == PROTOCOL_STX || b == PROTOCOL_ETX || b == PROTOCOL_ESC) {
      _rs485->write(PROTOCOL_ESC);
    }
    _rs485->write(b);
  }

  _rs485->write(PROTOCOL_ETX);
  _rs485->flush(); // Wait for TX complete

  // Switch back to RX Mode
  digitalWrite(PIN_RS485_DE, LOW);
}

void NetworkManager::sendButtonPress(bool pressed) {
  PacketPayload pkt;
  pkt.msgType = MSG_BUTTON_EVENT;
  pkt.nodeId = _myNodeId; // Identification
  pkt.data.button.pressed = pressed ? 1 : 0;

  // Note: RS485 collision danger.
  // In a strict Master-Slave, we should ONLY reply when POLLED.
  // For this prototype, we send immediately and hope for no collision
  // (since human presses are rare).
  sendPacket(pkt);
}

uint8_t NetworkManager::calculateCRC(const uint8_t *data, uint8_t len) {
  uint8_t crc = 0;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= data[i];
  }
  return crc;
}

void NetworkManager::onMessage(void (*callback)(const PacketPayload &msg)) {
  _userOnMessage = callback;
}
