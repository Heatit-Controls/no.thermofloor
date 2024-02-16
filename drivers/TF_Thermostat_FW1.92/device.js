'use strict';

const TF_ThermostatDevice = require('../TF_Thermostat/device');
const util = require('../../lib/util');

class TF_ThermostatFW192Device extends TF_ThermostatDevice {
  async onNodeInit() {
    await super.onNodeInit();

    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    this.registerCapability('thermofloor_onoff', 'BASIC', {
      report: 'BASIC_REPORT',
      reportParser: report => {
        if (report && report.hasOwnProperty('Current Value')) {
          const thermofloor_onoff_state = report['Current Value'] === 255;
          if (thermofloor_onoff_state !== this.getCapabilityValue('thermofloor_onoff')) {
            // Not needed since capability change will trigger the trigger card automatically
            // this.homey.app[`triggerThermofloorOnoff${thermofloor_onoff_state ? 'True' : 'False'}`].trigger(this, null, null);
            return thermofloor_onoff_state;
          }
        }
        return null;
      },
    });

    // registerCapability for measure_temperature for FW <=18.
    this.registerCapability('measure_temperature.internal', 'SENSOR_MULTILEVEL', {
      getOpts: {
        getOnStart: true,
      },
      multiChannelNodeId: 2,
    });

    this.node.MultiChannelNodes['2'].on('unknownReport', buf => {
      if (buf.length === 6) {
        const value = util.calculateTemperature(buf);
        this.setCapabilityValue('measure_temperature.internal', value).catch(this.error);
        if (this.getSetting('Temperature_thermostat') === 'internal') this.setCapabilityValue('measure_temperature', value).catch(this.error);
      }
    });

    // registerCapability for measure_temperature for FW <=18.
    this.registerCapability('measure_temperature.floor', 'SENSOR_MULTILEVEL', {
      getOpts: {
        getOnStart: true,
      },
      multiChannelNodeId: 4,
    });

    this.node.MultiChannelNodes['4'].on('unknownReport', buf => {
      if (buf.length === 6) {
        const value = util.calculateTemperature(buf);
        this.setCapabilityValue('measure_temperature.floor', value).catch(this.error);
        if (this.getSetting('Temperature_thermostat') === 'floor') this.setCapabilityValue('measure_temperature', value).catch(this.error);
      }
    });

    // registerCapability for measure_temperature for FW <=18.
    this.registerCapability('measure_temperature.external', 'SENSOR_MULTILEVEL', {
      getOpts: {
        getOnStart: true,
      },
      multiChannelNodeId: 3,
    });

    this.node.MultiChannelNodes['3'].on('unknownReport', buf => {
      if (buf.length === 6) {
        const value = util.calculateTemperature(buf);
        this.setCapabilityValue('measure_temperature.external', value).catch(this.error);
        if (this.getSetting('Temperature_thermostat') === 'external') this.setCapabilityValue('measure_temperature', value).catch(this.error);
      }
    });
  }

}

module.exports = TF_ThermostatFW192Device;
