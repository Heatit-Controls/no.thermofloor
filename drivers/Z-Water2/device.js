'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');

class Z_Water2Device extends ZwaveDevice {
  async onNodeInit() {
    this.registerCapability('onoff', 'SWITCH_BINARY', {
      getOpts: {
        getOnStart: true,
      },
    });

    if(this.hasCapability("measure_temperature.input1")) {
      this.registerCapability('measure_temperature.input1', 'SENSOR_MULTILEVEL', {
        multiChannelNodeId: 10,
      });
    }

    if(this.hasCapability("measure_temperature.input2")) {
      this.registerCapability('measure_temperature.input2', 'SENSOR_MULTILEVEL', {
        multiChannelNodeId: 11,
      });
    }

    this.setAvailable().catch(this.error);

  }

}

module.exports = Z_Water2Device;