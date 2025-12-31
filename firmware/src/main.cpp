#include "NetworkManager.h"
#include "NodeController.h"
#include <Arduino.h>
#include <FastLED.h>

// Define LED types and pins
#define LED_TYPE WS2812B // Or WS2815
#define COLOR_ORDER GRB

// Unique ID for this specific Node (Change for each device!)
// In production, this might be read from EEPROM or derived from MAC
#define MY_NODE_ID 1

// Arrays
CRGB hubLeds[NUM_LEDS_HUB];
CRGB strut1Leds[NUM_LEDS_STRUT];
CRGB strut2Leds[NUM_LEDS_STRUT];
CRGB strut3Leds[NUM_LEDS_STRUT];

NodeController node;
NetworkManager network;

// Network Callback
void OnNetworkMessage(const PacketPayload &msg) {
  if (msg.msgType == MSG_SET_COLOR) {
    // Determine if this message is for us (or global broadcast 0)
    // For now, we accept all broadcasts
    uint8_t r = msg.data.color.hubR;
    uint8_t g = msg.data.color.hubG;
    uint8_t b = msg.data.color.hubB;

    node.setHubColor(r, g, b);
    node.setStrutColor(0, msg.data.color.strR, msg.data.color.strG,
                       msg.data.color.strB);
    node.setStrutColor(1, msg.data.color.strR, msg.data.color.strG,
                       msg.data.color.strB);
    node.setStrutColor(2, msg.data.color.strR, msg.data.color.strG,
                       msg.data.color.strB);

    Serial.printf("Net Cmd: Color set to %d %d %d\n", r, g, b);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("Node Booting...");

  // Initialize LED strips
  FastLED.addLeds<LED_TYPE, PIN_LED_HUB, COLOR_ORDER>(hubLeds, NUM_LEDS_HUB)
      .setCorrection(TypicalLEDStrip);

  // Struts
  FastLED
      .addLeds<LED_TYPE, PIN_LED_STRUT1, COLOR_ORDER>(strut1Leds,
                                                      NUM_LEDS_STRUT)
      .setCorrection(TypicalLEDStrip);
  FastLED
      .addLeds<LED_TYPE, PIN_LED_STRUT2, COLOR_ORDER>(strut2Leds,
                                                      NUM_LEDS_STRUT)
      .setCorrection(TypicalLEDStrip);
  FastLED
      .addLeds<LED_TYPE, PIN_LED_STRUT3, COLOR_ORDER>(strut3Leds,
                                                      NUM_LEDS_STRUT)
      .setCorrection(TypicalLEDStrip);

  FastLED.setBrightness(128); // Default brightness

  node.begin(); // Setup local IO

  // Setup Network
  network.begin(MY_NODE_ID);
  network.onMessage(OnNetworkMessage);

  Serial.println("Node Ready.");
}

void loop() {
  network.update();
  node.update();
  NodeRegisters &regs = node.getRegisters();

  // 1. Handle Button Preses (Network)
  static bool lastButtonState = false;
  if (regs.buttonPressed != lastButtonState) {
    lastButtonState = regs.buttonPressed;
    Serial.printf("Button Changed: %d\n", lastButtonState);
    network.sendButtonPress(lastButtonState);
  }

  // 2. Update Hub LEDs based on Register Color
  // Effect: Pulse if button pressed, otherwise solid color
  CRGB hubColor = CRGB(regs.hubRed, regs.hubGreen, regs.hubBlue);
  if (regs.buttonPressed) {
    fill_solid(hubLeds, NUM_LEDS_HUB, CRGB::White);
  } else {
    fill_solid(hubLeds, NUM_LEDS_HUB, hubColor);
  }

  // 3. Update Strut LEDs
  fill_solid(strut1Leds, NUM_LEDS_STRUT,
             CRGB(regs.strut1Red, regs.strut1Green, regs.strut1Blue));
  fill_solid(strut2Leds, NUM_LEDS_STRUT,
             CRGB(regs.strut2Red, regs.strut2Green, regs.strut2Blue));
  fill_solid(strut3Leds, NUM_LEDS_STRUT,
             CRGB(regs.strut3Red, regs.strut3Green, regs.strut3Blue));

  // 4. Show
  FastLED.show();

  delay(10); // Stability
}
