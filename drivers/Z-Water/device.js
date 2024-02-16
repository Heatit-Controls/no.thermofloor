'use strict';

const Homey = require('homey');

const { ZwaveDevice } = require('homey-zwavedriver');

class Z_WaterDevice extends ZwaveDevice {
  onNodeInit() {
    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    if (this.hasCapability('measure_temperature.input1')) {
      this.registerCapability('onoff', 'BASIC', {
        getOpts: {
          getOnStart: true,
        },
        multiChannelNodeId: 1,
      });

      this.registerCapability('measure_temperature.input1', 'SENSOR_MULTILEVEL', {
        getOpts: {
          getOnStart: true,
        },
        multiChannelNodeId: 11,
        reportParser: report => this.temperatureReportParser(report),
      });

      this.registerCapability('measure_temperature.input2', 'SENSOR_MULTILEVEL', {
        getOpts: {
          getOnStart: true,
        },
        multiChannelNodeId: 12,
        reportParser: report => this.temperatureReportParser(report),
      });

      this.registerCapability('measure_temperature.input3', 'SENSOR_MULTILEVEL', {
        getOpts: {
          getOnStart: true,
        },
        multiChannelNodeId: 13,
        reportParser: report => this.temperatureReportParser(report),
      });

      this.registerCapability('measure_temperature.input4', 'SENSOR_MULTILEVEL', {
        getOpts: {
          getOnStart: true,
        },
        multiChannelNodeId: 14,
        reportParser: report => this.temperatureReportParser(report),
      });

      this.registerSetting('Temperature_report_interval_input1', value => Math.floor(value / 10));
      this.registerSetting('Temperature_report_interval_input2', value => Math.floor(value / 10));
      this.registerSetting('Temperature_report_interval_input3', value => Math.floor(value / 10));
      this.registerSetting('Temperature_report_interval_input4', value => Math.floor(value / 10));
    }

    if (this.hasCapability('onoff') && !this.hasCapability('measure_temperature.input1')) {
      this.registerCapability('onoff', 'BASIC', {
        getOpts: {
          getOnStart: true,
        },
      });
    }

    this.setAvailable().catch(this.error);
  }

  temperatureReportParser(report) {
    this.log('temperatureReportParser:', report);
    if (report
      && report.hasOwnProperty('Sensor Type')
      && report['Sensor Type'] === 'Temperature (version 1)'
      && report.hasOwnProperty('Sensor Value (Parsed)')) {

      return report['Sensor Value (Parsed)'];
    }

    return null;
  }

}

module.exports = Z_WaterDevice;
