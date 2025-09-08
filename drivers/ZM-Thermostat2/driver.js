'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {
  async onInit() {
    
    this._thermostatState = this.homey.flow.getDeviceTriggerCard("zmthermostat2_thermostat_state_IdleHeatCool")
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

module.exports = Driver;
