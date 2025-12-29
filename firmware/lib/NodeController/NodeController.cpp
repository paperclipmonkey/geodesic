#include "NodeController.h"

NodeController::NodeController()
    : _lastButtonState(HIGH), _lastDebounceTime(0) {
  // Initialize registers
  _regs = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, 0};
}

void NodeController::begin() { pinMode(PIN_BUTTON, INPUT_PULLUP); }

void NodeController::update() {
  handleButton();
  // LED updates are handled by reading registers in main loop
}

void NodeController::handleButton() {
  int reading = digitalRead(PIN_BUTTON);

  // If the switch changed, due to noise or pressing:
  if (reading != _lastButtonState) {
    _lastDebounceTime = millis();
  }

  if ((millis() - _lastDebounceTime) > _debounceDelay) {
    // If the reading has been there for longer than the debounce delay

    // In this specific case, standard debounce logic.
    // Assuming active LOW (pressed = 0)
    bool pressed = (reading == LOW);

    if (pressed != _regs.buttonPressed) {
      _regs.buttonPressed = pressed;
      if (pressed) {
        _regs.lastPressTime = millis();
      }
    }
  }

  _lastButtonState = reading;
}

void NodeController::setHubColor(uint8_t r, uint8_t g, uint8_t b) {
  _regs.hubRed = r;
  _regs.hubGreen = g;
  _regs.hubBlue = b;
}

void NodeController::setStrutColor(int strutIndex, uint8_t r, uint8_t g,
                                   uint8_t b) {
  if (strutIndex == 0) {
    _regs.strut1Red = r;
    _regs.strut1Green = g;
    _regs.strut1Blue = b;
  } else if (strutIndex == 1) {
    _regs.strut2Red = r;
    _regs.strut2Green = g;
    _regs.strut2Blue = b;
  } else if (strutIndex == 2) {
    _regs.strut3Red = r;
    _regs.strut3Green = g;
    _regs.strut3Blue = b;
  }
}

NodeRegisters &NodeController::getRegisters() { return _regs; }

bool NodeController::isButtonPressed() { return _regs.buttonPressed; }
