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

    if (this.hasCapability("meter_power.imported")) {
      await this.removeCapability("meter_power.imported",);
    }

    if (this.hasCapability('meter_power.exported') === false) {
      await this.addCapability('meter_power.exported');
    }

    if (this.hasCapability("accumulated_production")) {
      await this.removeCapability("accumulated_production",);
    }

    // Exported energy is derived from kVAh (Scale 0x01)
    this.registerExportedEnergy();

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

    // Map kVAh (Scale 0x01) to exported energy capability
    registerExportedEnergy() {
      this.registerCapability('meter_power.exported', 'METER', {
          getOpts: {
              getOnStart: true,
          },
          report: 'METER_REPORT',
          reportParser: (report) => {
              if (report && report.Properties2 && report.Properties2['Scale bits 10'] === 0x01) {
                  const parsedValue = Number(report['Meter Value (Parsed)']);
                  this.log('exported (kVAh): ', parsedValue);
                  return Number.isFinite(parsedValue) ? parsedValue : null;
              }
              return null;
          }
      });
  
      this.log('Z-HAN2 has been initialized');
      this.setAvailable().catch(this.error);
  }
}

module.exports = ZHAN2Device;