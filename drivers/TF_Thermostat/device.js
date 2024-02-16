'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');
const {
  Mode2Setting, Mode2Setpoint, Setpoint2Setting, Mode2Number,
} = require('../../lib/map/TF_mappings.js');

class TF_ThermostatDevice extends ZwaveDevice {
  async onNodeInit() {
    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    // registerCapability for measure_temperature for FW <=18.
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
      getOpts: {
        getOnStart: true,
        pollInterval: 'poll_interval_TEMPERATURE',
        pollMultiplication: 60000,
      },
    });

    this.registerCapability('thermofloor_onoff', 'BASIC', {
      report: 'BASIC_SET',
      reportParser: report => {
        if (report && report.hasOwnProperty('Value')) {
          const thermofloor_onoff_state = report.Value === 255;
          if (thermofloor_onoff_state !== this.getCapabilityValue('thermofloor_onoff')) {
            // Not needed since capability change will trigger the trigger card automatically
            // this.homey.app[`triggerThermofloorOnoff${thermofloor_onoff_state ? 'True' : 'False'}`].trigger(this, null, null);
            return thermofloor_onoff_state;
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
      setParserV2: thermostatMode => {
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
        if (this.getCapabilityValue('thermofloor_mode') != thermostatMode) {
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
      reportParserV2: report => {
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
          if (this.getCapabilityValue('thermofloor_mode') != thermostatMode) {
            const thermostatModeObj = {
              mode: thermostatMode,
              mode_name: this.homey.__(`mode.${thermostatMode}`),
            };
            this.homey.app.triggerThermofloorModeChanged.trigger(this, thermostatModeObj, null);
            this.homey.app.triggerThermofloorModeChangedTo.trigger(this, null, thermostatModeObj);

            // 4. Update onoff state when the thermostat mode is off
            if (thermostatMode === 'Off') {
              this.setCapabilityValue('thermofloor_onoff', false).catch(this.error);
              // this.homey.app[`triggerThermofloorOnoffFalse`].trigger(this, {}, {});
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
        // pollInterval: 'poll_interval_THERMOSTAT_SETPOINT',
        // pollMultiplication: 60000,
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
      setParser(setpointValue, options) {
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
      reportParser: report => {
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
            const setpointValue = readValue / Math.pow(10, report.Level2.Precision);
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
  }

}

module.exports = TF_ThermostatDevice;
