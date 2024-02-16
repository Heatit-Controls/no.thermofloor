'use strict';

const ThermostatTwoModeDevice = require('../../lib/ThermostatTwoModeDevice');

class Z_TEMP2Device extends ThermostatTwoModeDevice {
  async onNodeInit() {
    this.capabilityMultiChannelNodeIdObj = {
      locked: null,
      thermostat_mode_single: null,
      target_temperature: null,
      thermostat_state: null,
      measure_temperature: null,
      measure_humidity: null,
      measure_battery: null,
    };

    // enable debugging
    this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    await super.onNodeInit();

    // register a settings parser
    this.registerSetting('Proximity_sensor_enabled', value => (value ? 1 : 0));

    this.setAvailable().catch(this.error);
  }

}

module.exports = Z_TEMP2Device;

/* Node overview Secure
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] ------------------------------------------
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] Node: 90
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Manufacturer id: 411
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - ProductType id: 4
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Product id: 516
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Firmware Version: 1.1
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Hardware Version: 1
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Firmware id: 1540
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Firmware Version Target 1: 0.2
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Secure: ⨯
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Battery: false
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - DeviceClassBasic: BASIC_TYPE_ROUTING_SLAVE
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - DeviceClassGeneric: GENERIC_TYPE_THERMOSTAT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - DeviceClassSpecific: SPECIFIC_TYPE_THERMOSTAT_GENERAL_V2
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - Token: 2ae5c0b1-8601-4fc1-a8f8-83a4cf5981d1
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 2
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ZWAVEPLUS_INFO_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ZWAVEPLUS_INFO_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 2
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GROUPINGS_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GROUPINGS_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_REMOVE
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_SET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_SPECIFIC_GROUP_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_SPECIFIC_GROUP_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 3
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- MULTI_CHANNEL_ASSOCIATION_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- MULTI_CHANNEL_ASSOCIATION_REMOVE
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- MULTI_CHANNEL_ASSOCIATION_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- MULTI_CHANNEL_ASSOCIATION_SET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 3
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GROUP_NAME_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GROUP_NAME_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GROUP_INFO_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GROUP_INFO_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_GET
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_TRANSPORT_SERVICE
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 2
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- COMMAND_FIRST_SEGMENT
2020-06-02 22:01:30 [log] [ManagerDrivers] [Z-TEMP2] [0] --- COMMAND_SEGMENT_COMPLETE
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- COMMAND_SEGMENT_REQUEST
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- COMMAND_SEGMENT_WAIT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- COMMAND_SUBSEQUENT_SEGMENT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_VERSION
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 3
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- VERSION_COMMAND_CLASS_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- VERSION_COMMAND_CLASS_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- VERSION_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- VERSION_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- VERSION_CAPABILITIES_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- VERSION_CAPABILITIES_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- VERSION_ZWAVE_SOFTWARE_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- VERSION_ZWAVE_SOFTWARE_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_MANUFACTURER_SPECIFIC
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 2
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- MANUFACTURER_SPECIFIC_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- MANUFACTURER_SPECIFIC_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- DEVICE_SPECIFIC_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- DEVICE_SPECIFIC_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_DEVICE_RESET_LOCALLY
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- DEVICE_RESET_LOCALLY_NOTIFICATION
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_INDICATOR
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 3
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- INDICATOR_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- INDICATOR_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- INDICATOR_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_POWERLEVEL
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- POWERLEVEL_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- POWERLEVEL_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- POWERLEVEL_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- POWERLEVEL_TEST_NODE_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- POWERLEVEL_TEST_NODE_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- POWERLEVEL_TEST_NODE_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_BATTERY
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- BATTERY_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- BATTERY_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_SECURITY
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- NETWORK_KEY_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- NETWORK_KEY_VERIFY
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_COMMANDS_SUPPORTED_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_COMMANDS_SUPPORTED_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_MESSAGE_ENCAPSULATION
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_MESSAGE_ENCAPSULATION_NONCE_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_NONCE_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_NONCE_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_SCHEME_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_SCHEME_INHERIT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_SCHEME_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_SECURITY_2
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_NONCE_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_NONCE_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_MESSAGE_ENCAPSULATION
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- KEX_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- KEX_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- KEX_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- KEX_FAIL
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- PUBLIC_KEY_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_NETWORK_KEY_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_NETWORK_KEY_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_NETWORK_KEY_VERIFY
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_TRANSFER_END
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_COMMANDS_SUPPORTED_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_CAPABILITIES_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SECURITY_2_CAPABILITIES_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_NOTIFICATION
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 8
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- NOTIFICATION_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- NOTIFICATION_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- NOTIFICATION_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- NOTIFICATION_SUPPORTED_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- NOTIFICATION_SUPPORTED_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- EVENT_SUPPORTED_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- EVENT_SUPPORTED_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_SUPERVISION
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SUPERVISION_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SUPERVISION_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_FIRMWARE_UPDATE_MD
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 5
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_MD_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_MD_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_MD_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_MD_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_MD_REQUEST_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_MD_REQUEST_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_MD_STATUS_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_ACTIVATION_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_ACTIVATION_STATUS_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_MD_PREPARE_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- FIRMWARE_UPDATE_MD_PREPARE_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_MODE
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 3
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_MODE_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_MODE_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_MODE_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_MODE_SUPPORTED_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_MODE_SUPPORTED_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_SETPOINT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 3
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_SETPOINT_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_SETPOINT_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_SETPOINT_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_SETPOINT_SUPPORTED_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_SETPOINT_SUPPORTED_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_SETPOINT_CAPABILITIES_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_SETPOINT_CAPABILITIES_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_OPERATING_STATE
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_OPERATING_STATE_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- THERMOSTAT_OPERATING_STATE_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_PROTECTION
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- PROTECTION_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- PROTECTION_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- PROTECTION_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_CONFIGURATION
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 4
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_BULK_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_BULK_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_BULK_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_NAME_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_NAME_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_INFO_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_INFO_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_PROPERTIES_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_PROPERTIES_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- CONFIGURATION_DEFAULT_RESET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_SENSOR_MULTILEVEL
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 5
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SENSOR_MULTILEVEL_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SENSOR_MULTILEVEL_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SENSOR_MULTILEVEL_SUPPORTED_GET_SENSOR
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SENSOR_MULTILEVEL_SUPPORTED_SENSOR_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SENSOR_MULTILEVEL_SUPPORTED_GET_SCALE
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- SENSOR_MULTILEVEL_SUPPORTED_SCALE_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_APPLICATION_STATUS
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 1
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- APPLICATION_BUSY
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- APPLICATION_REJECTED_REQUEST
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] - CommandClass: COMMAND_CLASS_BASIC
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Version: 2
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] -- Commands:
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- BASIC_GET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- BASIC_REPORT
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] --- BASIC_SET
2020-06-02 22:01:31 [log] [ManagerDrivers] [Z-TEMP2] [0] ------------------------------------------

*/
