'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

class Z_Repeater extends ZwaveDevice {
  onNodeInit() {
    this.registerCapability('measure_battery', 'BATTERY', {
      getOpts: {
        getOnStart: true,
      }
    });

    this.registerCapability('alarm_power', 'NOTIFICATION', {
      get: 'NOTIFICATION_GET',
      getParser: () => ({
        'V1 Alarm Type': 0,
        'Notification Type': 'Power Management',
        Event: 3,
      }),
      getOpts: {
        getOnStart: true,
      },
      report: 'NOTIFICATION_REPORT',
      reportParser: report => {
        if (!report || !report['Notification Status'] || !report['Notification Type']) return null;

        // this.log(report['Event (Parsed)']);
        if (report['Event (Parsed)'] === 'AC mains disconnected') {
          return true;
        }

        if (report['Event (Parsed)'] === 'AC mains reconnected') {
          return false;
        }
      }
    });
  }
}

module.exports = Z_Repeater;
