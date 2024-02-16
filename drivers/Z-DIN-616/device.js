'use strict';

const Homey = require('homey');

const { ZwaveDevice } = require('homey-zwavedriver');

class Z_DIN616Device extends ZwaveDevice {
  async onNodeInit() {
    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    if (this.hasCapability('scene_notification_custom_capability')) {
      // Create list of corresponding multiChannelNodeDevices
      if (!this.multiChannelNodeDevices) {
        this.multiChannelNodeDevices = [];
        this.multiChannelNodeDevices[1] = this.driver.getDevices().find(device => device.getData().token === 1);
        this.multiChannelNodeDevices[2] = this.driver.getDevices().find(device => device.getData().token === 2);
        this.multiChannelNodeDevices[3] = this.driver.getDevices().find(device => device.getData().token === 3);
        this.multiChannelNodeDevices[4] = this.driver.getDevices().find(device => device.getData().token === 4);
        this.multiChannelNodeDevices[5] = this.driver.getDevices().find(device => device.getData().token === 5);
        this.multiChannelNodeDevices[6] = this.driver.getDevices().find(device => device.getData().token === 6);
      }

      // Register capability for Relay 1 (multiChannelNodeId 1)
      this.registerCapability('onoff', 'BASIC', {
        getOpts: {
          getOnStart: true,
        },
        multiChannelNodeId: 1,
      });

      // Register ReportListener for all remaining relays
      this.registerMultiChannelReportListener(7, 'BASIC', 'BASIC_SET', report => {
        if (report && report.hasOwnProperty('Value') && this.getSetting('Output_function_relay1') === '1') {
          return this.multiChannelNodeDevices[1].setCapabilityValue('onoff', report.Value === 255).catch(this.error);
        }
        return null;
      });

      this.registerMultiChannelReportListener(8, 'BASIC', 'BASIC_SET', report => {
        if (report && report.hasOwnProperty('Value') && this.getSetting('Output_function_relay2') === '1') {
          return this.multiChannelNodeDevices[2].setCapabilityValue('onoff', report.Value === 255).catch(this.error);
        }
        return null;
      });

      this.registerMultiChannelReportListener(9, 'BASIC', 'BASIC_SET', report => {
        if (report && report.hasOwnProperty('Value') && this.getSetting('Output_function_relay3') === '1') {
          return this.multiChannelNodeDevices[3].setCapabilityValue('onoff', report.Value === 255).catch(this.error);
        }
        return null;
      });

      this.registerMultiChannelReportListener(10, 'BASIC', 'BASIC_SET', report => {
        if (report && report.hasOwnProperty('Value') && this.getSetting('Output_function_relay4') === '1') {
          return this.multiChannelNodeDevices[4].setCapabilityValue('onoff', report.Value === 255).catch(this.error);
        }
        return null;
      });

      this.registerMultiChannelReportListener(11, 'BASIC', 'BASIC_SET', report => {
        if (report && report.hasOwnProperty('Value') && this.getSetting('Output_function_relay5') === '1') {
          return this.multiChannelNodeDevices[5].setCapabilityValue('onoff', report.Value === 255).catch(this.error);
        }
        return null;
      });

      this.registerMultiChannelReportListener(12, 'BASIC', 'BASIC_SET', report => {
        if (report && report.hasOwnProperty('Value') && this.getSetting('Output_function_relay6') === '1') {
          return this.multiChannelNodeDevices[6].setCapabilityValue('onoff', report.Value === 255).catch(this.error);
        }
        return null;
      });

      this.registerSetting('Input_Snubber_filter_time_constant', 	value => value * 100);
      this.registerSetting('Threshold_input_activation', 					value => value * 100);
      this.registerSetting('Threshold_input_latched_mode', 				value => value * 100);
    }

    if (this.hasCapability('onoff') && !this.hasCapability('scene_notification_custom_capability')) {
      this.registerCapability('onoff', 'BASIC');
    }
  }

}

module.exports = Z_DIN616Device;
