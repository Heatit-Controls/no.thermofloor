'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

module.exports = class ZSmokeBatteryDevice extends ZwaveDevice {
  async onNodeInit() {
    this.registerCapability('alarm_smoke', 'NOTIFICATION', {
      getOpts: {
        getOnStart: true,
      },
    });
    this.registerCapability('alarm_heat', 'NOTIFICATION', {
      getOpts: {
        getOnStart: true,
      },
    });

    this.registerCapability('alarm_motion', 'NOTIFICATION');

    this.registerCapability('alarm_tamper', 'NOTIFICATION', {
      getOpts: {
        getOnStart: true,
      },
    });

    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

    this.registerCapability('measure_battery', 'BATTERY', {
      getOpts: {
        getOnStart: true,
      },
    });

    this.registerCapability('alarm_siren', 'BASIC', {
      get: 'BASIC_GET',
      getOpts: {
        getOnStart: true,
      },
      set: 'BASIC_SET',
      setParser: value => ({
        Value: (value) ? 255 : 0,
      }),
      report: 'BASIC_REPORT',
      reportParser(report) {
        if (report && report.hasOwnProperty('Value')) return report.Value > 0;
        return null;
      },
    });

    this.setAvailable();
  }

};