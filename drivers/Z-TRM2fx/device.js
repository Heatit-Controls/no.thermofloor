'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');
const {
  Mode2Setting, Mode2Setpoint, Setpoint2Setting, Mode2Number,
} = require('../../lib/map/ZTRM2_mappings.js');
const util = require('../../lib/util');

class Z_TRM2fxDevice extends ZwaveDevice {
  async onNodeInit() {
    this.capabilityMultiChannelNodeIdObj = {
      thermofloor_mode: 1,
      target_temperature: 1,
      thermofloor_onoff: 1,
      meter_power: 1,
      measure_power: 1,
      measure_voltage: 1,
      'measure_temperature.external': 2,
      'measure_temperature.floor': 3,
      'button.reset_meter': 1,
    };

    // enable debugging
    //this.enableDebug();

    // print the node's info to the console
    //this.printNode();

    // registerCapability for measure_temperature for FW <=18.
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
      getOpts: {
        getOnStart: true,
      },
    });

    // registerCapability for the external temperature sensor
    this.registerCapability('measure_temperature.external', 'SENSOR_MULTILEVEL', {
      getOpts: {
        getOnStart: true,
      },
      report: 'SENSOR_MULTILEVEL_REPORT',
      reportParser: report => {
        if (report
					&& report.hasOwnProperty('Sensor Type')
					&& report['Sensor Type'] === 'Temperature (version 1)'
					&& report.hasOwnProperty('Sensor Value (Parsed)')
					&& report.hasOwnProperty('Level')
					&& report.Level.hasOwnProperty('Scale')) {
          // Some devices send this when no temperature sensor is connected
          if (report['Sensor Value (Parsed)'] === -999.9) return null;
          if (report.Level.Scale === 0) {
            if (this.getSetting('Temperature_thermostat') === 'external') this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)']).catch(this.error);
            return report['Sensor Value (Parsed)'];
          }
          if (report.Level.Scale === 1) {
            if (this.getSetting('Temperature_thermostat') === 'external') this.setCapabilityValue('measure_temperature', (report['Sensor Value (Parsed)'] - 32) / 1.8).catch(this.error);
            return (report['Sensor Value (Parsed)'] - 32) / 1.8;
          }
        }
        return null;
      },
      multiChannelNodeId: 2,
    });

    this.node.MultiChannelNodes['2'].on('unknownReport', buf => {
      if (buf.length === 6) {
        const value = util.calculateTemperature(buf);
        this.log('measure_temperature.external', value);
        this.setCapabilityValue('measure_temperature.external', value).catch(this.error);
        if (this.getSetting('Temperature_thermostat') === 'external') this.setCapabilityValue('measure_temperature', value).catch(this.error);
      }
    });

    // registerCapability for the external temperature sensor
    this.registerCapability('measure_temperature.floor', 'SENSOR_MULTILEVEL', {
      getOpts: {
        getOnStart: true,
      },
      report: 'SENSOR_MULTILEVEL_REPORT',
      reportParser: report => {
        if (report
					&& report.hasOwnProperty('Sensor Type')
					&& report['Sensor Type'] === 'Temperature (version 1)'
					&& report.hasOwnProperty('Sensor Value (Parsed)')
					&& report.hasOwnProperty('Level')
					&& report.Level.hasOwnProperty('Scale')) {
          // Some devices send this when no temperature sensor is connected
          if (report['Sensor Value (Parsed)'] === -999.9) return null;
          if (report.Level.Scale === 0) {
            if (this.getSetting('Temperature_thermostat') === 'floor') this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)']).catch(this.error);
            return report['Sensor Value (Parsed)'];
          }
          if (report.Level.Scale === 1) {
            if (this.getSetting('Temperature_thermostat') === 'floor') this.setCapabilityValue('measure_temperature', (report['Sensor Value (Parsed)'] - 32) / 1.8).catch(this.error);
            return (report['Sensor Value (Parsed)'] - 32) / 1.8;
          }
        }
        return null;
      },
      multiChannelNodeId: 3,
    });

    // used for secure mode:
    this.node.MultiChannelNodes['3'].on('unknownReport', buf => {
      if (buf.length === 6) {
        const value = util.calculateTemperature(buf);
        this.log('measure_temperature.floor', value);
        this.setCapabilityValue('measure_temperature.floor', value).catch(this.error);
        if (this.getSetting('Temperature_thermostat') === 'floor') this.setCapabilityValue('measure_temperature', value).catch(this.error);
      }
    });

    this.registerCapability('thermofloor_onoff', 'BASIC', {
      report: 'BASIC_REPORT',
      reportParser: report => {
        if (report && report.hasOwnProperty('Current Value')) {
          const thermofloorOnoffState = report['Current Value'] === 255;
          if (thermofloorOnoffState !== this.getCapabilityValue('thermofloor_onoff')) {
            return thermofloorOnoffState;
          }
        }
        return null;
      },
    });

    this.registerCapability('thermofloor_mode', 'THERMOSTAT_MODE', {
      getOpts: {
        getOnStart: true,
        // pollInterval: 'poll_interval_THERMOSTAT_MODE',
        // pollMultiplication: 60000,
      },
      get: 'THERMOSTAT_MODE_GET',
      set: 'THERMOSTAT_MODE_SET',
      setParserV3: thermostatMode => {
        this.log('Setting thermostat mode to:', thermostatMode);

        // 1. Update thermostat setpoint based on matching thermostat mode
        const setpointType = Mode2Setpoint[thermostatMode];

        if (setpointType !== 'not supported') {
          this.setCapabilityValue('target_temperature', this.getStoreValue(`thermostatsetpointValue.${setpointType}`) || null).catch(this.error);
        } else {
          this.setCapabilityValue('target_temperature', null).catch(this.error);
        }

        // 2. Update device settings thermostat mode
        this.setSettings({
          operation_mode: Mode2Number[thermostatMode],
        }).catch(this.error);

        // 3. Trigger mode trigger cards if the mode is actually changed
        if (this.getCapabilityValue('thermofloor_mode') !== thermostatMode) {
          const thermostatModeObj = {
            mode: thermostatMode,
            mode_name: this.homey.__(`mode.${thermostatMode}`),
          };
          this.homey.app.triggerThermofloorModeChanged.trigger(this, thermostatModeObj, null);
          this.homey.app.triggerThermofloorModeChangedTo.trigger(this, null, thermostatModeObj);

          // 4. Update onoff state when the thermostat mode is off
          if (thermostatMode === 'Off') {
            this.setCapabilityValue('thermofloor_onoff', false).catch(this.error);
          }
        }
        // 5. Return setParser object and update thermofloor_mode capability
        return {
          Level: {
            'No of Manufacturer Data fields': 0,
            Mode: thermostatMode,
          },
          'Manufacturer Data': Buffer.from([0]),
        };
      },
      report: 'THERMOSTAT_MODE_REPORT',
      reportParserV3: report => {
        if (!report) return null;
        if (report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Mode')) {
          const thermostatMode = report.Level.Mode;
          this.log('Received thermostat mode report:', thermostatMode);

          // 1. Update thermostat setpoint value based on matching thermostat mode
          const setpointType = Mode2Setpoint[thermostatMode];

          if (setpointType !== 'not supported') {
            this.setCapabilityValue('target_temperature', this.getStoreValue(`thermostatsetpointValue.${setpointType}`) || null).catch(this.error);
          } else {
            this.setCapabilityValue('target_temperature', null).catch(this.error);
          }

          // 2. Update device settings thermostat mode
          this.setSettings({
            operation_mode: Mode2Number[thermostatMode],
          }).catch(this.error);

          // 3. Trigger mode trigger cards if the mode is actually changed
          if (this.getCapabilityValue('thermofloor_mode') !== thermostatMode) {
            const thermostatModeObj = {
              mode: thermostatMode,
              mode_name: this.homey.__(`mode.${thermostatMode}`),
            };
            this.homey.app.triggerThermofloorModeChanged.trigger(this, thermostatModeObj, null);
            this.homey.app.triggerThermofloorModeChangedTo.trigger(this, null, thermostatModeObj);

            // 4. Update onoff state when the thermostat mode is off
            if (thermostatMode === 'Off') {
              this.setCapabilityValue('thermofloor_onoff', false).catch(this.error);
            }
          }

          // 5. Return reportParser object and update thermofloor_mode capability
          return thermostatMode;
        }
        return null;
      },
    });

    this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
      getOpts: {
        getOnStart: true,
      },
      getParser: () => {
        // 1. Retrieve the setpointType based on the thermostat mode
        const setpointType = Mode2Setpoint[this.getCapabilityValue('thermofloor_mode') || 'Heat'];

        // 2. Return getParser object with correct setpointType
        return {
          Level: {
            'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
          },
        };
      },
      set: 'THERMOSTAT_SETPOINT_SET',
      setParserV3: (setpointValue, options) => {
        // 1. Retrieve the setpointType based on the thermostat mode
        const setpointType = options.hasOwnProperty('mode') ? Mode2Setpoint[options.mode] : Mode2Setpoint[this.getCapabilityValue('thermofloor_mode') || 'Heat'];

        this.log('Setting thermostat setpoint to:', setpointValue, 'for setpointType', setpointType);

        if (setpointType !== 'not supported') {
          // 2. Store thermostat setpoint based on thermostat type
          this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);

          // 3. Update device settings setpoint value
          const setpointSetting = Setpoint2Setting[setpointType];
          this.setSettings({
            [setpointSetting]: setpointValue * 10,
          }).catch(this.error);

          // 4. Return setParser object and update thermostat mode
          const bufferValue = Buffer.alloc(2);
          bufferValue.writeUInt16BE((Math.round(setpointValue * 2) / 2 * 10).toFixed(0));

          return {
            Level: {
              'Setpoint Type': setpointType,
            },
            Level2: {
              Size: 2,
              Scale: 0,
              Precision: 1,
            },
            Value: bufferValue,
          };
        }

        return null;
      },
      report: 'THERMOSTAT_SETPOINT_REPORT',
      reportParserV3: report => {
        if (report && report.hasOwnProperty('Level2')
					&& report.Level2.hasOwnProperty('Scale')
					&& report.Level2.hasOwnProperty('Precision')
					&& report.Level2.Scale === 0
					&& typeof report.Level2.Size !== 'undefined') {
          // 1. Try to read the readValue
          let readValue;
          try {
            readValue = report.Value.readUIntBE(0, report.Level2.Size);
          } catch (err) {
            return null;
          }

          if (typeof readValue !== 'undefined') {
            // 2. Define the setPointValue and setpointType
            const setpointValue = readValue / 10 ** report.Level2.Precision; // Math.pow(10, report.Level2.Precision);
            const setpointType = report.Level['Setpoint Type'];
            this.log('Received thermostat setpoint report: Setpoint type', setpointType, ' Setpoint value', setpointValue);

            // 3. Store thermostat setpoint based on thermostat type
            if (setpointType !== 'not supported') {
              this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);
            }

            // 4. Update device settings setpoint value
            const setpointSetting = Setpoint2Setting[setpointType];
            this.setSettings({
              [setpointSetting]: setpointValue * 10,
            }).catch(this.error);

            // 5. Update UI if reported setpointType equals active sepointType based on the thermostat mode
            if (setpointType === Mode2Setpoint[this.getCapabilityValue('thermofloor_mode') || 'Heat']) {
              this.log('Updated thermostat setpoint on UI to', setpointValue);
              return setpointValue;
            }

            return null;
          }
          return null;
        }
        return null;
      },
    });

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

    if (this.hasCapability('meter_power')) this.registerCapability('meter_power', 'METER'); // , { getOpts: { getOnStart: false } });
    if (this.hasCapability('measure_power')) this.registerCapability('measure_power', 'METER'); // , { getOpts: { getOnStart: false } });
    if (this.hasCapability('measure_voltage')) this.registerCapability('measure_voltage', 'METER'); // , { getOpts: { getOnStart: false } });

    this.setAvailable().catch(this.error);
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

module.exports = Z_TRM2fxDevice;

/* Node overview Secure
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] ZwaveDevice has been inited
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] ------------------------------------------
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] Node: be4ae13c-c5fe-4600-b670-09e3f0166851
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - Battery: false
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_THERMOSTAT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ZWAVEPLUS_INFO_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ZWAVEPLUS_INFO_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUPINGS_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUPINGS_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_REMOVE
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_SET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_SPECIFIC_GROUP_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_SPECIFIC_GROUP_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_NAME_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_NAME_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_INFO_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_INFO_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_REMOVE
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_SET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_MULTI_CHANNEL
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 4
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_CAPABILITY_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_CAPABILITY_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_CMD_ENCAP
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_END_POINT_FIND
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_END_POINT_FIND_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_END_POINT_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_END_POINT_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_INSTANCE_CMD_ENCAP
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_INSTANCE_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_INSTANCE_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_AGGREGATED_MEMBERS_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_AGGREGATED_MEMBERS_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_TRANSPORT_SERVICE
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_FIRST_SEGMENT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_SEGMENT_COMPLETE
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_SEGMENT_REQUEST
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_SEGMENT_WAIT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_SUBSEQUENT_SEGMENT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_VERSION
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_COMMAND_CLASS_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_COMMAND_CLASS_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_CAPABILITIES_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_CAPABILITIES_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_ZWAVE_SOFTWARE_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_ZWAVE_SOFTWARE_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_MANUFACTURER_SPECIFIC
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MANUFACTURER_SPECIFIC_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MANUFACTURER_SPECIFIC_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- DEVICE_SPECIFIC_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- DEVICE_SPECIFIC_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_DEVICE_RESET_LOCALLY
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- DEVICE_RESET_LOCALLY_NOTIFICATION
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_POWERLEVEL
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_GET
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_REPORT
2019-09-14 15:25:27 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_TEST_NODE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_TEST_NODE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_TEST_NODE_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_SECURITY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- NETWORK_KEY_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_MESSAGE_ENCAPSULATION_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_SCHEME_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_SCHEME_INHERIT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_SCHEME_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_SECURITY_2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- KEX_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- KEX_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- KEX_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- KEX_FAIL
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- PUBLIC_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NETWORK_KEY_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NETWORK_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_TRANSFER_END
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_CAPABILITIES_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_CAPABILITIES_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SUPERVISION_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SUPERVISION_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_CONFIGURATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_BULK_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_BULK_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_BULK_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_NAME_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_NAME_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_INFO_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_INFO_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_PROPERTIES_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_PROPERTIES_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_FIRMWARE_UPDATE_MD
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 4
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_MD_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_MD_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_REQUEST_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_REQUEST_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_STATUS_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_ACTIVATION_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_ACTIVATION_STATUS_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_SETPOINT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_CAPABILITIES_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_CAPABILITIES_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_MODE
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_METER
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_RESET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_BASIC
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- BASIC_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- BASIC_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- BASIC_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - MultiChannelNode: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_THERMOSTAT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SECURITY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- NETWORK_KEY_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_MESSAGE_ENCAPSULATION_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_INHERIT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SECURITY_2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_FAIL
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- PUBLIC_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_TRANSFER_END
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_CAPABILITIES_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_CAPABILITIES_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_BASIC
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - MultiChannelNode: 2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_SENSOR_MULTILEVEL
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SECURITY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- NETWORK_KEY_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_MESSAGE_ENCAPSULATION_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_INHERIT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SECURITY_2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_FAIL
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- PUBLIC_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_TRANSFER_END
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_CAPABILITIES_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_CAPABILITIES_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_BASIC
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - MultiChannelNode: 3
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_SENSOR_MULTILEVEL
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SECURITY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- NETWORK_KEY_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_MESSAGE_ENCAPSULATION_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_INHERIT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SECURITY_2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_FAIL
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- PUBLIC_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_TRANSFER_END
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_CAPABILITIES_GET
2019-09-14 15:25:28 [err] [ManagerDrivers] [Z-TRM2fx] [0] CommandClass: SENSOR_MULTILEVEL in main node undefined
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_CAPABILITIES_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_BASIC
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - MultiChannelNode: 4
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_SWITCH_BINARY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SECURITY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- NETWORK_KEY_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_MESSAGE_ENCAPSULATION_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_INHERIT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_SCHEME_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SECURITY_2
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NONCE_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NONCE_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_MESSAGE_ENCAPSULATION
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- KEX_FAIL
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- PUBLIC_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_NETWORK_KEY_VERIFY
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_TRANSFER_END
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_COMMANDS_SUPPORTED_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_CAPABILITIES_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SECURITY_2_CAPABILITIES_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_BASIC
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_GET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_REPORT
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_SET
2019-09-14 15:25:28 [log] [ManagerDrivers] [Z-TRM2fx] [0] ------------------------------------------

//// non secure inclusion:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] ZwaveDevice has been inited
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] ------------------------------------------
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] Node: e80fe105-579a-4357-8064-658f6ceba76e
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - Battery: false
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_THERMOSTAT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ZWAVEPLUS_INFO_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ZWAVEPLUS_INFO_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_REMOVE
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_SET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_SPECIFIC_GROUP_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_SPECIFIC_GROUP_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_NAME_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_NAME_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_INFO_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_INFO_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_REMOVE
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_ASSOCIATION_SET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_MULTI_CHANNEL
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 4
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_CAPABILITY_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_CAPABILITY_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_CMD_ENCAP
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_END_POINT_FIND
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_END_POINT_FIND_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_END_POINT_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_END_POINT_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_INSTANCE_CMD_ENCAP
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_INSTANCE_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_INSTANCE_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_AGGREGATED_MEMBERS_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MULTI_CHANNEL_AGGREGATED_MEMBERS_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_TRANSPORT_SERVICE
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_FIRST_SEGMENT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_SEGMENT_COMPLETE
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_SEGMENT_REQUEST
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_SEGMENT_WAIT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- COMMAND_SUBSEQUENT_SEGMENT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_VERSION
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_COMMAND_CLASS_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_COMMAND_CLASS_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_CAPABILITIES_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_CAPABILITIES_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_ZWAVE_SOFTWARE_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- VERSION_ZWAVE_SOFTWARE_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_MANUFACTURER_SPECIFIC
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MANUFACTURER_SPECIFIC_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- MANUFACTURER_SPECIFIC_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- DEVICE_SPECIFIC_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- DEVICE_SPECIFIC_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_DEVICE_RESET_LOCALLY
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- DEVICE_RESET_LOCALLY_NOTIFICATION
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_POWERLEVEL
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_SET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_TEST_NODE_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_TEST_NODE_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- POWERLEVEL_TEST_NODE_SET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_SECURITY
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- NETWORK_KEY_SET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- NETWORK_KEY_VERIFY
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_COMMANDS_SUPPORTED_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_COMMANDS_SUPPORTED_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_MESSAGE_ENCAPSULATION
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_MESSAGE_ENCAPSULATION_NONCE_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_NONCE_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_NONCE_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_SCHEME_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_SCHEME_INHERIT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_SCHEME_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_SECURITY_2
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NONCE_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NONCE_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_MESSAGE_ENCAPSULATION
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- KEX_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- KEX_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- KEX_SET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- KEX_FAIL
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- PUBLIC_KEY_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NETWORK_KEY_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NETWORK_KEY_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_NETWORK_KEY_VERIFY
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_TRANSFER_END
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_COMMANDS_SUPPORTED_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_COMMANDS_SUPPORTED_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_CAPABILITIES_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SECURITY_2_CAPABILITIES_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 1
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SUPERVISION_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- SUPERVISION_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_CONFIGURATION
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_BULK_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_BULK_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_BULK_SET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_SET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_NAME_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_NAME_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_INFO_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_INFO_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_PROPERTIES_GET
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- CONFIGURATION_PROPERTIES_REPORT
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_FIRMWARE_UPDATE_MD
2019-09-15 08:20:05 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 4
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_MD_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_MD_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_REQUEST_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_REQUEST_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_MD_STATUS_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_ACTIVATION_SET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- FIRMWARE_UPDATE_ACTIVATION_STATUS_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_SETPOINT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_SET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_SUPPORTED_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_SUPPORTED_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_CAPABILITIES_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_SETPOINT_CAPABILITIES_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_THERMOSTAT_MODE
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_SET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_SUPPORTED_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- THERMOSTAT_MODE_SUPPORTED_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_METER
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 3
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_RESET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_SUPPORTED_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- METER_SUPPORTED_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] - CommandClass: COMMAND_CLASS_BASIC
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Version: 2
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- BASIC_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- BASIC_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- BASIC_SET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] - MultiChannelNode: 1
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_THERMOSTAT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_REMOVE
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SPECIFIC_GROUP_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SPECIFIC_GROUP_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_NAME_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_NAME_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_INFO_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_INFO_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 3
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_REMOVE
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_SET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_GET
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_REPORT
2019-09-15 08:20:06 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_THERMOSTAT_SETPOINT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 3
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_SETPOINT_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_SETPOINT_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_SETPOINT_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_SETPOINT_SUPPORTED_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_SETPOINT_SUPPORTED_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_SETPOINT_CAPABILITIES_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_SETPOINT_CAPABILITIES_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_THERMOSTAT_MODE
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 3
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_MODE_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_MODE_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_MODE_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_MODE_SUPPORTED_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- THERMOSTAT_MODE_SUPPORTED_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_BASIC
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] - MultiChannelNode: 2
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_SENSOR_MULTILEVEL
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_REMOVE
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SPECIFIC_GROUP_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SPECIFIC_GROUP_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_NAME_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_NAME_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_INFO_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_INFO_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 3
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_REMOVE
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SENSOR_MULTILEVEL
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SENSOR_MULTILEVEL_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SENSOR_MULTILEVEL_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_BASIC
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] - MultiChannelNode: 3
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_SENSOR_MULTILEVEL
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_REMOVE
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SPECIFIC_GROUP_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SPECIFIC_GROUP_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_NAME_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_NAME_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_INFO_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_INFO_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 3
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_REMOVE
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SENSOR_MULTILEVEL
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SENSOR_MULTILEVEL_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SENSOR_MULTILEVEL_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_BASIC
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] - MultiChannelNode: 4
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] - DeviceClassGeneric: GENERIC_TYPE_SWITCH_BINARY
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ZWAVEPLUS_INFO
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ZWAVEPLUS_INFO_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 2
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_REMOVE
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_REPORT
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SET
2019-09-15 08:20:07 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SPECIFIC_GROUP_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_SPECIFIC_GROUP_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_ASSOCIATION_GRP_INFO
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_NAME_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_NAME_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_INFO_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_INFO_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- ASSOCIATION_GROUP_COMMAND_LIST_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 3
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_GROUPINGS_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_REMOVE
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- MULTI_CHANNEL_ASSOCIATION_SET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SUPERVISION
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SUPERVISION_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_SWITCH_BINARY
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SWITCH_BINARY_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SWITCH_BINARY_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- SWITCH_BINARY_SET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_METER
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 3
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- METER_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- METER_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- METER_RESET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- METER_SUPPORTED_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- METER_SUPPORTED_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] -- CommandClass: COMMAND_CLASS_BASIC
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Version: 1
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] --- Commands:
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_GET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_REPORT
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ---- BASIC_SET
2019-09-15 08:20:08 [log] [ManagerDrivers] [Z-TRM2fx] [0] ------------------------------------------
*/
