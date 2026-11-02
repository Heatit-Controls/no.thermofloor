'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

class ZHAN2Device extends ZwaveDevice {
  async onNodeInit() {
    // Temporary diagnostics for missing Energy/Insights readings.
    // this.enableDebug();
   
    // **Enables printing nodes
    // this.printNode();

    // Keep meter_power so existing Insights and Flows retain the imported total.
    if (!this.hasCapability('meter_power.exported')) {
      await this.addCapability('meter_power.exported');
    }

    this.registerEnergyMeter('meter_power', 0);
    this.registerEnergyMeter('meter_power.exported', 1);
    this.registerCapability('measure_power', 'METER', {
      reportParserOverride: true,
      reportParser: report => {
        const value = this.parseMeterReport(report, 2);
        if (value === null) return null;

        const rateType = report.Properties1['Rate Type'];
        if (rateType === 'Export' || rateType === 2) return -Math.abs(value);
        if (rateType === 'Import' || rateType === 1) return value;
        return null;
      },
    });
    this.registerCapability('measure_voltage', 'METER');
    this.registerCapability('measure_current', 'METER');
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

    // Continue updating legacy capabilities without deleting their history or Flows.
    if (this.hasCapability('meter_power.imported')) {
      this.registerEnergyMeter('meter_power.imported', 0, false);
    }
    if (this.hasCapability('accumulated_production')) {
      this.registerEnergyMeter('accumulated_production', 1, false);
    }

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
    this.log('Z-HAN2 has been initialized');
    await this.setAvailable();
  }

  registerEnergyMeter(capabilityId, scale, getOnStart = true) {
    // Z-HAN2 reports accumulated production on scale 1 (labelled kVAh in
    // Z-Wave), with rate Import, rather than kWh with rate Export.
    // See the Z-HAN2 manual, section 15.1. This mapping is device-specific.
    this.registerCapability(capabilityId, 'METER', {
      get: 'METER_GET',
      getOpts: { getOnStart },
      getParserV4: () => ({
        Properties1: {
          'Rate Type': 'Import',
          Scale: scale,
        },
        'Scale 2': 0,
      }),
      report: 'METER_REPORT',
      reportParserOverride: true,
      reportParser: report => {
        const value = this.parseMeterReport(report, scale);
        if (value === null || value < 0) return null;

        const rateType = report.Properties1['Rate Type'];
        return rateType === 'Import' || rateType === 1 ? value : null;
      },
    });
  }

  parseMeterReport(report, scale) {
    if (!report || !report.Properties1 || !report.Properties2) return null;

    const properties = report.Properties1;
    if (properties['Meter Type'] !== 'Electric meter' && properties['Meter Type'] !== 1) {
      return null;
    }
    if (properties['Scale bit 2'] !== false && properties['Scale bit 2'] !== 0) return null;
    if (report.Properties2['Scale bits 10'] !== scale) return null;
    if (report['Scale 2'] !== undefined && report['Scale 2'] !== 0) return null;

    const value = report['Meter Value (Parsed)'];
    return Number.isFinite(value) ? value : null;
  }
}

module.exports = ZHAN2Device;