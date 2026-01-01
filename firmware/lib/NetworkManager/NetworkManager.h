#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>

// RS485 Configuration (Defaults if not set in PIO)
#ifndef PIN_RS485_RX
#define PIN_RS485_RX 16
#endif
#ifndef PIN_RS485_TX
#define PIN_RS485_TX 17
#endif
#ifndef PIN_RS485_DE
#define PIN_RS485_DE 4
#endif

// Protocol Constants
#define PROTOCOL_STX 0x02
#define PROTOCOL_ETX 0x03
#define PROTOCOL_ESC 0x1B
#define BROADCAST_ID 0

// Message Types
enum MessageType {
  MSG_POLL = 0x01,        // Master asking "Anything to report?"
  MSG_HEARTBEAT = 0x02,   // Keepalive
  MSG_SET_COLOR = 0x03,   // Command to set LEDs
  MSG_BUTTON_EVENT = 0x04 // Node reporting button press
};

// Fixed Size Packet
// [STX][LEN][CMD][ID][PAYLOAD...][CRC][ETX]
// We use a struct to model the inner data
#define MAX_PAYLOAD_SIZE 16

struct PacketPayload {
  uint8_t msgType;
  uint8_t nodeId; // Destination ID for commands, Source ID for replies

  union {
    struct {
      uint8_t hubR, hubG, hubB;
      uint8_t strR, strG, strB;
    } color;

    struct {
      uint8_t pressed;
    } button;
  } data;
};

class NetworkManager {
public:
  NetworkManager();

  // Setup
  void begin(uint8_t myNodeId);

  // Main Loop
  void update();

  // Sending
  void sendButtonPress(bool pressed);

  // Callbacks
  void onMessage(void (*callback)(const PacketPayload &msg));

private:
  uint8_t _myNodeId;
  HardwareSerial *_rs485;

  void (*_userOnMessage)(const PacketPayload &msg);

  // RX Buffer
  uint8_t _rxBuffer[32];
  uint8_t _rxIndex;
  bool _receiving;
  bool _escaped;

  // Helpers
  void sendPacket(const PacketPayload &pkt);
  uint8_t calculateCRC(const uint8_t *data, uint8_t len);
  void processPacket(const uint8_t *data, uint8_t len);
  void processAppMessage(const PacketPayload &pkt);
};

#endif
