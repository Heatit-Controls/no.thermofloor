'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');


class ZHAN2Device extends ZwaveDevice {
  async onNodeInit() {
    // **Enables debugging**
    //this.enableDebug();
   
    // **Enables printing nodes
    // this.printNode();

    this.registerCapability('meter_power', 'METER', {
      report: 'METER_REPORT',
      reportParser: (report) => {
        if (report && report.hasOwnProperty('Properties1') && (report['Properties1']['Meter Type'] & 0x01) === 0x01) {
          if (report['Properties2'] && (report['Properties2']['Scale bits 10'] === 0x00)) {
            return report['Meter Value (Parsed)'];
          }
        }
        return null;
      },
    });

    this.registerCapability('meter_power.export', 'METER', {
      get: 'METER_GET',
      getOpts: {
        getOnStart: true,
      },
      getParser: () => {
        return {
          'Rate Type': 'Export',
          'Scale': 1,
        };
      },
      report: 'METER_REPORT',
      reportParser: (report) => {
        if (report && report.hasOwnProperty('Properties1') && (report['Properties1']['Meter Type'] & 0x01) === 0x01) {
          if (report['Properties2'] && report['Properties2']['Scale bits 10'] === 0x01) {
            return report['Meter Value (Parsed)'];
          }
        }
        return null;
      },
    });

    this.registerCapability('measure_power', 'METER');
    this.registerCapability('measure_voltage', 'METER');
    this.registerCapability('measure_current', 'METER');
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

    this.registerCapabilityListener('button.reset_meter', async () => {
      let commandClassMeter = null;
      commandClassMeter = this.getCommandClass('METER');
      if (commandClassMeter && commandClassMeter.hasOwnProperty('METER_RESET')) {
        const result = await commandClassMeter.METER_RESET({});
        if (result !== 'TRANSMIT_COMPLETE_OK') throw result;
      }
      else {
        throw new Error('Reset meter not supported');
      }
    });

    //listener for kVAh
  
      this.log('Z-HAN2 has been initialized');
      this.setAvailable().catch(this.error);
  }
}

module.exports = ZHAN2Device;