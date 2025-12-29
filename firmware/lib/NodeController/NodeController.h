#ifndef NODE_CONTROLLER_H
#define NODE_CONTROLLER_H

#include <Arduino.h>
#include <FastLED.h>

// Configuration macros (defaults if not defined in PIO)
#ifndef PIN_LED_HUB
#define PIN_LED_HUB 13
#endif
#ifndef PIN_BUTTON
#define PIN_BUTTON 33
#endif

// Register structure for Comms
struct NodeRegisters {
    uint8_t hubRed;
    uint8_t hubGreen;
    uint8_t hubBlue;
    uint8_t strut1Red;
    uint8_t strut1Green;
    uint8_t strut1Blue;
    uint8_t strut2Red;
    uint8_t strut2Green;
    uint8_t strut2Blue;
    uint8_t strut3Red;
    uint8_t strut3Green;
    uint8_t strut3Blue;
    bool buttonPressed;
    uint32_t lastPressTime;
};

class NodeController {
public:
    NodeController();
    void begin();
    void update();

    // Setters for logic
    void setHubColor(uint8_t r, uint8_t g, uint8_t b);
    void setStrutColor(int strutIndex, uint8_t r, uint8_t g, uint8_t b);
    
    // Getters
    bool isButtonPressed();
    NodeRegisters& getRegisters();

private:
    void handleButton();
    void updateLEDs();

    // LED Arrays
    // We treat the struts as pointers to arrays passed in from main to allow flexible sizing
    // For simplicity in this demo, we assume fixed arrays declared in main and passed here? 
    // Actually, simpler to own the logic here if sizes are compile-time constants.
    
    // However, FastLED templates require compile-time pin definitions which makes a generic library hard
    // without templating the controller. 
    // STRATEGY: NodeController purely manages STATE. Main.cpp handles FastLED showing.
    
    NodeRegisters _regs;
    
    // Button State
    bool _lastButtonState;
    uint32_t _lastDebounceTime;
    uint32_t _debounceDelay = 50;
};

#endif
