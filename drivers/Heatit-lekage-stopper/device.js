'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');



class HeatitLeakageStopper extends ZwaveDevice {
  onNodeInit() {

    this.registerCapability('onoff', 'SWITCH_BINARY');
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

    this.registerCapability('alarm_water', 'NOTIFICATION', {
      getOpts: {
        getOnStart: true,
      },
    });
  }
}

module.exports = HeatitLeakageStopper;
