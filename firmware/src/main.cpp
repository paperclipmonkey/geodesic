#include "NodeController.h"
#include <Arduino.h>
#include <FastLED.h>

// Define LED types and pins
#define LED_TYPE WS2812B // Or WS2815
#define COLOR_ORDER GRB

// Arrays
CRGB hubLeds[NUM_LEDS_HUB];
CRGB strut1Leds[NUM_LEDS_STRUT];
CRGB strut2Leds[NUM_LEDS_STRUT];
CRGB strut3Leds[NUM_LEDS_STRUT];

NodeController node;

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

  node.begin();
  Serial.println("Node Ready.");
}

void loop() {
  node.update();
  NodeRegisters &regs = node.getRegisters();

  // 1. Update Hub LEDs based on Register Color
  // Effect: Pulse if button pressed, otherwise solid color
  CRGB hubColor = CRGB(regs.hubRed, regs.hubGreen, regs.hubBlue);
  if (regs.buttonPressed) {
    fill_solid(hubLeds, NUM_LEDS_HUB, CRGB::White);
  } else {
    fill_solid(hubLeds, NUM_LEDS_HUB, hubColor);
  }

  // 2. Update Strut LEDs
  // In a real scenario, we might have patterns. Here simply flood fill from
  // registers.
  fill_solid(strut1Leds, NUM_LEDS_STRUT,
             CRGB(regs.strut1Red, regs.strut1Green, regs.strut1Blue));
  fill_solid(strut2Leds, NUM_LEDS_STRUT,
             CRGB(regs.strut2Red, regs.strut2Green, regs.strut2Blue));
  fill_solid(strut3Leds, NUM_LEDS_STRUT,
             CRGB(regs.strut3Red, regs.strut3Green, regs.strut3Blue));

  // 3. Show
  FastLED.show();

  // 4. Debug output periodically
  static uint32_t lastPrint = 0;
  if (millis() - lastPrint > 1000) {
    lastPrint = millis();
    // Simulate "Reading" data from a controller by cycling colors if defaults
    // are black
    if (regs.hubRed == 0 && regs.hubGreen == 0 && regs.hubBlue == 0) {
      // Demo mode
      uint8_t hue = (millis() / 20) % 255;
      node.setHubColor(255, 0, 255); // Magenta setup
                                     // node.setStrutColor(0, ...);
    }

    Serial.printf("Btn: %d | Hub: %02x%02x%02x\n", regs.buttonPressed,
                  regs.hubRed, regs.hubGreen, regs.hubBlue);
  }

  delay(10); // Stability
}
