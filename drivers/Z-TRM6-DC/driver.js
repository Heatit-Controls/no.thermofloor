'use strict';

const Homey = require('homey');

class ZTRM6DCDriver extends Homey.Driver {
  async onInit() {
    this._thermostatState = this.homey.flow.getDeviceTriggerCard("ztrm6dc_thermostat_state_IdleHeatCool")
      .registerRunListener((args, state) => {
        return args.thermostat_state === state.state;
      });
  }

  triggerThermostatState(device, tokens, state) {
    const flowState = {
      state: typeof state === 'object' ? state.state : state
    };

    this._thermostatState
      .trigger(device, flowState, flowState)
      .catch(this.error);
  }
}

module.exports = ZTRM6DCDriver;
