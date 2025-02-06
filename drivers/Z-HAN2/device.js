'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');


class ZHAN2Device extends ZwaveDevice {
  async onNodeInit() {
    // **Enables debugging**
    //this.enableDebug();
   
    // **Enables printing nodes
    // this.printNode();

    this.registerCapability('meter_power', 'METER');
    this.registerCapability('measure_power', 'METER');
    this.registerCapability('measure_voltage', 'METER');
    this.registerCapability('measure_current', 'METER');
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

    if (this.hasCapability('meter_power.exported')) {
      await this.removeCapability('meter_power.exported');
    }

    if (this.hasCapability("meter_power.imported")) {
      await this.removeCapability("meter_power.imported",);
    }

    if (this.hasCapability('accumulated_production') === false ) {
      await this.addCapability('accumulated_production');
    }

    this.registerAccumulatedProduction();

    this.registerCapabilityListener('button.reset_meter', async () => {
      let commandClassMeter = null;
      commandClassMeter = this.getCommandClass('METER');
      if(commandClassMeter && commandClassMeter.hasOwnProperty('METER_RESET')){
        const result = await commandClassMeter.METER_RESET({});
        if(result !== 'TRANSMIT_COMPLETE_OK') throw result;
      }
      else{
        throw new Error('Reset meter not supported');
      }
    });
    }

    //listener for kVAh
    registerAccumulatedProduction() {
      this.registerCapability('accumulated_production', 'METER', {
          getOpts: {
              getOnStart: true,
          },
          report: 'METER_REPORT',
          reportParser: (report) => {
              if (report && report.Properties2 && report.Properties2['Scale bits 10'] === 0x01) {
                  let parsedValue = Number(report['Meter Value (Parsed)']);
                  this.log('kVAh: ', parsedValue);
                  return !isNaN(parsedValue) ? parsedValue : null;
              }
              return null;
          }
      });
  
      this.log('Z-HAN2 has been initialized');
      this.setAvailable().catch(this.error);
  }
}

module.exports = ZHAN2Device;