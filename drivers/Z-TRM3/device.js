'use strict';

const ThermostatTwoModeDevice = require('../../lib/ThermostatTwoModeDevice');

class Z_TRM3Device extends ThermostatTwoModeDevice {
  async onNodeInit() {
    this.capabilityMultiChannelNodeIdObj = {
      thermostat_mode_single: 1,
      target_temperature: 1,
      thermostat_state: 1,
      meter_power: 1,
      measure_power: 1,
      measure_voltage: 1,
      'measure_temperature.internal': 2,
      'measure_temperature.external': 3,
      'measure_temperature.floor': 4,
      'button.reset_meter': 1,
    };

    await super.onNodeInit();
    this.setAvailable().catch(this.error);
  }
}

module.exports = Z_TRM3Device;