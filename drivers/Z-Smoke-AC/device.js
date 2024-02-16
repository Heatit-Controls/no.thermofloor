'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

module.exports = class ZSmokeACDevice extends ZwaveDevice {
  async onNodeInit() {
    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

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

    this.registerCapability('alarm_power', 'NOTIFICATION', {
      get: 'NOTIFICATION_GET',
      getParser: () => ({
        'V1 Alarm Type': 0,
        'Notification Type': 'Power Management',
        Event: 2,
      }),
      getOpts: {
        getOnStart: true,
      },
      report: 'NOTIFICATION_REPORT',
      reportParser: report => {
        if (report && report['Notification Type'] === 'Power Management' && report.hasOwnProperty('Event (Parsed)')) {
          if (report['Event (Parsed)'] === 'AC mains disconnected') {
            this.log('Oeps AC disconnected');
            return true;
          }

          if (report['Event (Parsed)'] === 'AC mains reconnected' || report['Event (Parsed)'] === 'Event inactive') {
            this.log('AC connected again');
            return false;
          }
        }
        return null;
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

    this.setAvailable().catch(this.error);
  }

};

/* Node overview Secure
2020-09-06 10:21:21 [log] [ManagerDrivers] [Z-Smoke-AC] [0] ZwaveDevice has been inited
2020-09-06 10:21:21 [log] [ManagerDrivers] [Z-Smoke-AC] [0] Node: 107 | Manufacturer id: 411 | ProductType id: 3 | Product id: 13 | Firmware Version: 4.1 | Hardware Version: 255 | Firmware id: 781 | Secure: ⨯ | Battery: false
2020-09-06 10:21:21 [log] [ManagerDrivers] [Z-Smoke-AC] [0] ------------------------------------------
2020-09-06 10:21:21 [log] [ManagerDrivers] [Z-Smoke-AC] [0] Node: 107
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - Manufacturer id: 411
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - ProductType id: 3
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - Product id: 13
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - Firmware Version: 4.1
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - Hardware Version: 255
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - Firmware id: 781
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - Secure: ⨯
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - Battery: false
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - DeviceClassBasic: BASIC_TYPE_ROUTING_SLAVE
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - DeviceClassGeneric: GENERIC_TYPE_SENSOR_NOTIFICATION
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - DeviceClassSpecific: SPECIFIC_TYPE_NOTIFICATION_SENSOR
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - Token: a77ab274-5000-4098-a3e1-7eba4fb39943
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 2
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ZWAVEPLUS_INFO_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ZWAVEPLUS_INFO_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_SWITCH_BINARY
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 1
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SWITCH_BINARY_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SWITCH_BINARY_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SWITCH_BINARY_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 2
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GROUPINGS_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GROUPINGS_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_REMOVE
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_SPECIFIC_GROUP_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_SPECIFIC_GROUP_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 3
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- MULTI_CHANNEL_ASSOCIATION_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- MULTI_CHANNEL_ASSOCIATION_REMOVE
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- MULTI_CHANNEL_ASSOCIATION_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- MULTI_CHANNEL_ASSOCIATION_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 1
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GROUP_NAME_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GROUP_NAME_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GROUP_INFO_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GROUP_INFO_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_TRANSPORT_SERVICE
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 2
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- COMMAND_FIRST_SEGMENT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- COMMAND_SEGMENT_COMPLETE
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- COMMAND_SEGMENT_REQUEST
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- COMMAND_SEGMENT_WAIT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- COMMAND_SUBSEQUENT_SEGMENT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_VERSION
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 3
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- VERSION_COMMAND_CLASS_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- VERSION_COMMAND_CLASS_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- VERSION_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- VERSION_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- VERSION_CAPABILITIES_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- VERSION_CAPABILITIES_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- VERSION_ZWAVE_SOFTWARE_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- VERSION_ZWAVE_SOFTWARE_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_MANUFACTURER_SPECIFIC
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 2
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- MANUFACTURER_SPECIFIC_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- MANUFACTURER_SPECIFIC_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- DEVICE_SPECIFIC_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- DEVICE_SPECIFIC_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_DEVICE_RESET_LOCALLY
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 1
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- DEVICE_RESET_LOCALLY_NOTIFICATION
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_POWERLEVEL
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 1
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- POWERLEVEL_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- POWERLEVEL_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- POWERLEVEL_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- POWERLEVEL_TEST_NODE_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- POWERLEVEL_TEST_NODE_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- POWERLEVEL_TEST_NODE_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_BATTERY
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 1
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- BATTERY_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- BATTERY_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_NOTIFICATION
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 8
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- NOTIFICATION_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- NOTIFICATION_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- NOTIFICATION_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- NOTIFICATION_SUPPORTED_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- NOTIFICATION_SUPPORTED_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- EVENT_SUPPORTED_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- EVENT_SUPPORTED_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_SENSOR_MULTILEVEL
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 11
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SENSOR_MULTILEVEL_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SENSOR_MULTILEVEL_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SENSOR_MULTILEVEL_SUPPORTED_GET_SENSOR
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SENSOR_MULTILEVEL_SUPPORTED_SENSOR_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SENSOR_MULTILEVEL_SUPPORTED_GET_SCALE
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SENSOR_MULTILEVEL_SUPPORTED_SCALE_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_SECURITY_2
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 1
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_NONCE_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_NONCE_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_MESSAGE_ENCAPSULATION
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- KEX_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- KEX_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- KEX_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- KEX_FAIL
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- PUBLIC_KEY_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_NETWORK_KEY_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_NETWORK_KEY_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_NETWORK_KEY_VERIFY
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_TRANSFER_END
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_COMMANDS_SUPPORTED_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_CAPABILITIES_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SECURITY_2_CAPABILITIES_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_SUPERVISION
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 1
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SUPERVISION_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- SUPERVISION_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_FIRMWARE_UPDATE_MD
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 4
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_MD_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_MD_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_UPDATE_MD_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_UPDATE_MD_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_UPDATE_MD_REQUEST_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_UPDATE_MD_REQUEST_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_UPDATE_MD_STATUS_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_UPDATE_ACTIVATION_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- FIRMWARE_UPDATE_ACTIVATION_STATUS_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] - CommandClass: COMMAND_CLASS_BASIC
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Version: 2
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] -- Commands:
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- BASIC_GET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- BASIC_REPORT
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] --- BASIC_SET
2020-09-06 10:21:22 [log] [ManagerDrivers] [Z-Smoke-AC] [0] ------------------------------------------

*/
