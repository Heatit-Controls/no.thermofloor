'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');
const util = require('../../lib/util');

class Z_RelayDevice extends ZwaveDevice {
  async onNodeInit() {
    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    this.registerCapability('onoff', 'SWITCH_BINARY', {
      getOpts: {
        getOnStart: true,
      },
      // multiChannelNodeId: 1
    });

    this.registerCapability('measure_temperature.input1', 'SENSOR_MULTILEVEL', {
      multiChannelNodeId: 2,
    });

    this.node.MultiChannelNodes['2'].on('unknownReport', buf => {
      if (buf.length === 6) {
        const value = util.calculateTemperature(buf);
        this.log('temperature input1', buf, value);
        this.setCapabilityValue('measure_temperature.input1', value).catch(this.error);
      }
    });

    this.registerCapability('measure_temperature.input2', 'SENSOR_MULTILEVEL', {
      multiChannelNodeId: 3,
    });

    this.node.MultiChannelNodes['3'].on('unknownReport', buf => {
      if (buf.length === 6) {
        const value = util.calculateTemperature(buf);
        this.log('temperature input2', buf, value);
        this.setCapabilityValue('measure_temperature.input2', value).catch(this.error);
      }
    });

    this.registerCapability('alarm_water', 'NOTIFICATION', {
      multiChannelNodeId: 4,
    });

    this.registerCapability('alarm_water', 'BASIC', {
      report: 'BASIC_SET',
      reportParser: report => {
        if (report && report.hasOwnProperty('Value')) return report.Value === 255;
        return null;
      },
      multiChannelNodeId: 4,
    });

    if (this._isRootNode()) {
      if (!this.hasCapability('button.reset_meter')) await this.addCapability('button.reset_meter').catch(this.error);
      if (this.hasCapability('button.reset_meter')) {
        // Listen for reset_meter maintenance action
        this.registerCapabilityListener('button.reset_meter', async () => {
          // Maintenance action button was pressed, return a promise
          if (typeof this.meterReset === 'function') return this.meterReset();
          this.error('Reset meter failed');
          throw new Error('Reset meter not supported');
        });
      }

      if (this.hasCapability('meter_power')) this.registerCapability('meter_power', 'METER', { getOpts: { getOnStart: true } });
      if (this.hasCapability('measure_power')) this.registerCapability('measure_power', 'METER' , { getOpts: { getOnStart: true } });
      if (this.hasCapability('measure_voltage')) this.registerCapability('measure_voltage', 'METER' , { getOpts: { getOnStart: true } });
    }

    this.registerSetting('Temperature_report_interval_input1', value => Math.floor(value / 10));
    this.registerSetting('Temperature_report_interval_input2', value => Math.floor(value / 10));
    this.registerSetting('Temperature_report_interval_input3', value => Math.floor(value / 10));
    this.registerSetting('Temperature_report_interval_input4', value => Math.floor(value / 10));
    this.registerSetting('Meter_report_interval_relay', value => Math.floor(value / 10));
  }

  /**
 * Method that determines if current node is root node.
 * @returns {boolean}
 * @private
 */
  _isRootNode() {
    return Object.prototype.hasOwnProperty.call(this.node, 'MultiChannelNodes') && Object.keys(this.node.MultiChannelNodes).length > 0;
  }

}

module.exports = Z_RelayDevice;
