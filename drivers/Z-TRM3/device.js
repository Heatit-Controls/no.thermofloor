'use strict';

const ThermostatTwoModeDevice = require('../../lib/ThermostatTwoModeDevice');

const ASSOCIATION_GROUP_MIGRATED_STORE_FLAG = 'migratedAssociationGroups';

class Z_TRM3Device extends ThermostatTwoModeDevice {
  async onNodeInit() {
    this.capabilityMultiChannelNodeIdObj = {
      thermostat_mode_single: 1,
      target_temperature: 1,
      thermostat_state: 1,
      meter_power: 1,
      measure_power: 1,
      measure_voltage: 1,
      'measure_temperature.internal': 2,
      'measure_temperature.external': 3,
      'measure_temperature.floor': 4,
      'button.reset_meter': 1,
    };

    await super.onNodeInit();


    await this._configureMultiChannelAssociation();

    // enable debugging
    this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    this.setAvailable().catch(this.error);
  }

  /**
   * Method that will first remove any present association in group 1 and will then set association group 1 to '1.1'.
   * @returns {Promise<boolean>}
   * @private
   */
  async _configureMultiChannelAssociation() {
    const isMigrated = this.getStoreValue(ASSOCIATION_GROUP_MIGRATED_STORE_FLAG);
    if (!isMigrated) {
      const associationGroup1Report = await this.node.CommandClass.COMMAND_CLASS_ASSOCIATION.ASSOCIATION_GET(Buffer.from(([1])));
      this.log('Normal association configuration, nodeID present', associationGroup1Report.hasOwnProperty('NodeID'));
      if (associationGroup1Report.hasOwnProperty('NodeID')) {
        if (this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION) {
          if (this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION.MULTI_CHANNEL_ASSOCIATION_SET) {
            await this.node.CommandClass.COMMAND_CLASS_ASSOCIATION.ASSOCIATION_REMOVE(Buffer.from([1, 1]));
            await this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION.MULTI_CHANNEL_ASSOCIATION_SET(
              Buffer.from([1, 0x00, 1, 1]),
            );
            await this.setSettings({ zw_group_1: '1.1' }).catch(this.error);
            this.setStoreValue(ASSOCIATION_GROUP_MIGRATED_STORE_FLAG, true).catch(this.error);
            this.log('Multi channel association configured correctly');
            return true;
          }
        }
        throw new Error('multi_channel_association_not_supported');
      }
      this.log('Multi channel association not required');
      this.setStoreValue(ASSOCIATION_GROUP_MIGRATED_STORE_FLAG, true).catch(this.error);
      return true;
    }
    this.log('Multi channel association already configured');
    return true;
  }

}

module.exports = Z_TRM3Device;

/* Node overview Secure
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] ------------------------------------------
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] Node: 82
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Manufacturer id: 411
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - ProductType id: 3
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Product id: 515
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Firmware Version: 4.0
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Hardware Version: 3
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Firmware id: 771
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Firmware Version Target 1: 4.0
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Secure: ⨯
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Battery: false
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - DeviceClassBasic: BASIC_TYPE_ROUTING_SLAVE
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - DeviceClassGeneric: GENERIC_TYPE_THERMOSTAT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - DeviceClassSpecific: SPECIFIC_TYPE_THERMOSTAT_GENERAL_V2
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - Token: 30c18c8f-0a3e-4ff7-b236-436c7e94cdae
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 2
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ZWAVEPLUS_INFO_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ZWAVEPLUS_INFO_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 2
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_REMOVE
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_SET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_SPECIFIC_GROUP_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_SPECIFIC_GROUP_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 1
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GROUP_NAME_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GROUP_NAME_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GROUP_INFO_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GROUP_INFO_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 3
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_ASSOCIATION_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_ASSOCIATION_REMOVE
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_ASSOCIATION_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_ASSOCIATION_SET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_MULTI_CHANNEL
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 4
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_CAPABILITY_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_CAPABILITY_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_CMD_ENCAP
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_END_POINT_FIND
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_END_POINT_FIND_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_END_POINT_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_END_POINT_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_INSTANCE_CMD_ENCAP
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_INSTANCE_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_INSTANCE_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_AGGREGATED_MEMBERS_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MULTI_CHANNEL_AGGREGATED_MEMBERS_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_TRANSPORT_SERVICE
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 2
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- COMMAND_FIRST_SEGMENT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- COMMAND_SEGMENT_COMPLETE
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- COMMAND_SEGMENT_REQUEST
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- COMMAND_SEGMENT_WAIT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- COMMAND_SUBSEQUENT_SEGMENT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_VERSION
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 3
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- VERSION_COMMAND_CLASS_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- VERSION_COMMAND_CLASS_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- VERSION_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- VERSION_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- VERSION_CAPABILITIES_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- VERSION_CAPABILITIES_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- VERSION_ZWAVE_SOFTWARE_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- VERSION_ZWAVE_SOFTWARE_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_MANUFACTURER_SPECIFIC
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 2
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MANUFACTURER_SPECIFIC_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- MANUFACTURER_SPECIFIC_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- DEVICE_SPECIFIC_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- DEVICE_SPECIFIC_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_DEVICE_RESET_LOCALLY
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 1
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- DEVICE_RESET_LOCALLY_NOTIFICATION
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_POWERLEVEL
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 1
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- POWERLEVEL_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- POWERLEVEL_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- POWERLEVEL_SET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- POWERLEVEL_TEST_NODE_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- POWERLEVEL_TEST_NODE_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- POWERLEVEL_TEST_NODE_SET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_SECURITY
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 1
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- NETWORK_KEY_SET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- NETWORK_KEY_VERIFY
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_COMMANDS_SUPPORTED_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_COMMANDS_SUPPORTED_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_MESSAGE_ENCAPSULATION
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_MESSAGE_ENCAPSULATION_NONCE_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_NONCE_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_NONCE_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_SCHEME_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_SCHEME_INHERIT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_SCHEME_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_SECURITY_2
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 1
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_NONCE_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_NONCE_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_MESSAGE_ENCAPSULATION
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- KEX_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- KEX_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- KEX_SET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- KEX_FAIL
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- PUBLIC_KEY_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_NETWORK_KEY_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_NETWORK_KEY_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_NETWORK_KEY_VERIFY
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_TRANSFER_END
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_COMMANDS_SUPPORTED_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_CAPABILITIES_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SECURITY_2_CAPABILITIES_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_SUPERVISION
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 1
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SUPERVISION_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- SUPERVISION_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_CONFIGURATION
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 3
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_BULK_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_BULK_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_BULK_SET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_SET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_NAME_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_NAME_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_INFO_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_INFO_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_PROPERTIES_GET
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] --- CONFIGURATION_PROPERTIES_REPORT
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_FIRMWARE_UPDATE_MD
2020-05-23 10:26:20 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 4
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_MD_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_MD_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_UPDATE_MD_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_UPDATE_MD_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_UPDATE_MD_REQUEST_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_UPDATE_MD_REQUEST_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_UPDATE_MD_STATUS_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_UPDATE_ACTIVATION_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- FIRMWARE_UPDATE_ACTIVATION_STATUS_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_SETPOINT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_SETPOINT_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_SETPOINT_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_SETPOINT_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_SETPOINT_SUPPORTED_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_SETPOINT_SUPPORTED_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_SETPOINT_CAPABILITIES_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_SETPOINT_CAPABILITIES_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_MODE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_MODE_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_MODE_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_MODE_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_MODE_SUPPORTED_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_MODE_SUPPORTED_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_OPERATING_STATE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_OPERATING_STATE_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- THERMOSTAT_OPERATING_STATE_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_METER
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- METER_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- METER_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- METER_RESET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- METER_SUPPORTED_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- METER_SUPPORTED_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - CommandClass: COMMAND_CLASS_BASIC
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Version: 2
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- BASIC_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- BASIC_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- BASIC_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - MultiChannelNode: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - DeviceClassGeneric: GENERIC_TYPE_THERMOSTAT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 2
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ZWAVEPLUS_INFO_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ZWAVEPLUS_INFO_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 2
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_REMOVE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SPECIFIC_GROUP_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SPECIFIC_GROUP_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_NAME_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_NAME_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_INFO_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_INFO_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_REMOVE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SUPERVISION_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SUPERVISION_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_THERMOSTAT_SETPOINT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_SETPOINT_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_SETPOINT_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_SETPOINT_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_SETPOINT_SUPPORTED_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_SETPOINT_SUPPORTED_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_SETPOINT_CAPABILITIES_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_SETPOINT_CAPABILITIES_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_THERMOSTAT_MODE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_MODE_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_MODE_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_MODE_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_MODE_SUPPORTED_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_MODE_SUPPORTED_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_THERMOSTAT_OPERATING_STATE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_OPERATING_STATE_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- THERMOSTAT_OPERATING_STATE_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_METER
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- METER_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- METER_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- METER_RESET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- METER_SUPPORTED_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- METER_SUPPORTED_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_BASIC
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - MultiChannelNode: 2
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - DeviceClassGeneric: GENERIC_TYPE_SENSOR_MULTILEVEL
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 2
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ZWAVEPLUS_INFO_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ZWAVEPLUS_INFO_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 2
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_REMOVE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SPECIFIC_GROUP_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SPECIFIC_GROUP_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_NAME_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_NAME_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_INFO_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_INFO_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_REMOVE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SUPERVISION_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SUPERVISION_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_SENSOR_MULTILEVEL
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SENSOR_MULTILEVEL_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SENSOR_MULTILEVEL_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_BASIC
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - MultiChannelNode: 3
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] - DeviceClassGeneric: GENERIC_TYPE_SENSOR_MULTILEVEL
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 2
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ZWAVEPLUS_INFO_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ZWAVEPLUS_INFO_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 2
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_REMOVE
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SPECIFIC_GROUP_GET
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SPECIFIC_GROUP_REPORT
2020-05-23 10:26:21 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_NAME_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_NAME_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_INFO_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_INFO_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 3
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_REMOVE
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_SET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SUPERVISION_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SUPERVISION_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_SENSOR_MULTILEVEL
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SENSOR_MULTILEVEL_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SENSOR_MULTILEVEL_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_BASIC
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_SET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] - MultiChannelNode: 4
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] - DeviceClassGeneric: GENERIC_TYPE_SENSOR_MULTILEVEL
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 2
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ZWAVEPLUS_INFO_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ZWAVEPLUS_INFO_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 2
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_REMOVE
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SPECIFIC_GROUP_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_SPECIFIC_GROUP_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_NAME_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_NAME_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_INFO_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_INFO_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 3
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_REMOVE
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- MULTI_CHANNEL_ASSOCIATION_SET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SUPERVISION_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SUPERVISION_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_SENSOR_MULTILEVEL
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SENSOR_MULTILEVEL_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- SENSOR_MULTILEVEL_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] -- CommandClass: COMMAND_CLASS_BASIC
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Version: 1
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] --- Commands:
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_GET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_REPORT
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ---- BASIC_SET
2020-05-23 10:26:22 [log] [ManagerDrivers] [Z-TRM3] [0] ------------------------------------------

1.1:
Received application command for COMMAND_CLASS_ASSOCIATION, data: 0x03010500
Received application command for COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION, data: 0x03010500000101

1:
Received application command for COMMAND_CLASS_ASSOCIATION, data: 0x0301050001
Received application command for COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION, data: 0x0301050001

After inclusion:
Received application command for COMMAND_CLASS_ASSOCIATION, data: 0x0301050001
Received application command for COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION, data: 0x0301050001000101

Without "associationGroups": [ ],
Received application command for COMMAND_CLASS_ASSOCIATION, data: 0x03010500
Received application command for COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION, data: 0x03010500000101
*/
