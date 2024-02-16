'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');
const {
  Mode2Setting, Mode2Setpoint, Setpoint2Setting, Mode2Number,
} = require('./map/ZTRM3_mappings.js');

class ThermostatTwoModeDevice extends ZwaveDevice {
  async onNodeInit() {
    this.registerCapability('thermostat_mode_single', 'THERMOSTAT_MODE', {
      getOpts: {
        getOnStart: true,
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
        if (this.getCapabilityValue('thermostat_mode_single') !== thermostatMode) {
          const thermostatModeObj = {
            mode: thermostatMode,
            mode_name: this.homey.__(`mode.${thermostatMode}`),
          };
          this.homey.app.triggerThermofloorModeChanged.trigger(this, thermostatModeObj, null);
          this.homey.app.triggerThermostatModeChangedTo.trigger(this, null, thermostatModeObj);

          // 4. Update onoff state when the thermostat mode is off
          if (thermostatMode === 'Off') {
            this.setCapabilityValue('thermostat_state', false).catch(this.error);
          }
        }
        // 5. Return setParser object and update thermostat_mode_single capability
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
          if (this.getCapabilityValue('thermostat_mode_single') !== thermostatMode) {
            const thermostatModeObj = {
              mode: thermostatMode,
              mode_name: this.homey.__(`mode.${thermostatMode}`),
            };
            this.homey.app.triggerThermofloorModeChanged.trigger(this, thermostatModeObj, null);
            this.homey.app.triggerThermostatModeChangedTo.trigger(this, null, thermostatModeObj);

            // 4. Update onoff state when the thermostat mode is off
            if (thermostatMode === 'Off') {
              this.setCapabilityValue('thermostat_state', false).catch(this.error);
            }
          }

          this.setCapabilityValue('onoff', thermostatMode === 'Heat');

          // 5. Return reportParser object and update thermostat_mode_single capability
          return thermostatMode;
        }
        return null;
      },
      multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['thermostat_state'],
    });

    this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
      getOpts: {
        getOnStart: true,
      },
      getParser: () => {
        // 1. Retrieve the setpointType based on the thermostat mode
        const setpointType = Mode2Setpoint[this.getCapabilityValue('thermostat_mode_single') || 'Heat'];

        // 2. Return getParser object with correct setpointType
        return {
          Level: {
            'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
          },
        };
      },
      set: 'THERMOSTAT_SETPOINT_SET',
      setParserV3: setpointValue => {
        // 1. Retrieve the setpointType based on the thermostat mode
        this.log('Mode2Setpoint', setpointValue, this.getCapabilityValue('thermostat_mode_single'), Mode2Setpoint[this.getCapabilityValue('thermostat_mode_single') || 'Heat']);
        const setpointType = Mode2Setpoint[this.getCapabilityValue('thermostat_mode_single') || 'Heat'];

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
          this.log('Set thermostat setpointValue:', setpointValue, setpointValue * 10, (Math.round(setpointValue * 2) / 2 * 10).toFixed(0), bufferValue);

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
            const setpointValue = readValue / 10 ** report.Level2.Precision;
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
            if (setpointType === Mode2Setpoint[this.getCapabilityValue('thermostat_mode_single') || 'Heat']) {
              this.log('Updated thermostat setpoint on UI to', setpointValue);
              return setpointValue;
            }

            return null;
          }
          return null;
        }
        return null;
      },
      multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['thermostat_mode_single'],
    });

    // register a capability listener
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    this.registerCapability('thermostat_state', 'THERMOSTAT_OPERATING_STATE', {
      getOpts: {
        getOnStart: true,
      },
      get: 'THERMOSTAT_OPERATING_STATE_GET',
      report: 'THERMOSTAT_OPERATING_STATE_REPORT',
      reportParser: report => {
        if (report && report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Operating State')) {
          const thermostatState = report.Level['Operating State'] === 'Heating';
          if (thermostatState !== this.getCapabilityValue('thermostat_state')) {
            return thermostatState;
          }
        }
        return null;
      },
      multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['thermostat_state'],
    });

    // register optional capabilities
    // register locked capability if available
    if (this.hasCapability('locked')) {
      this.registerCapability('locked', 'PROTECTION', {
        getOpts: {
          getOnStart: true,
        },
        get: 'PROTECTION_GET',
        set: 'PROTECTION_SET',
        setParser: value => {
          return { 'Protection State': value ? 'Protection by sequence' : 'Unprotected' };
        },
        report: 'PROTECTION_REPORT',
        reportParser: report => {
          if (report.hasOwnProperty('Protection State')) {
            return report['Protection State'] === 'Protection by sequence';
          }
          return null;
        },
        multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['locked'],
      });
    }

    // register measure_temperature capabilities if available
    Object.keys(this.capabilityMultiChannelNodeIdObj).forEach(capabilityId => {
      if (capabilityId.includes('measure_temperature')) {
        const subName = capabilityId.split('.')[1];

        // register main measure_temperature capability
        if (this.hasCapability(capabilityId) && subName === undefined) {
          this.log('Registering Capability', capabilityId, 'at multiChannelNodeId', this.capabilityMultiChannelNodeIdObj[capabilityId]);
          // registerCapability for the internal temperature sensor
          this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
            getOpts: { getOnStart: true },
            multiChannelNodeId: this.capabilityMultiChannelNodeIdObj[capabilityId],
          });
        } else if (this.hasCapability(capabilityId) && subName !== undefined) {
          this.log('Registering Capability', capabilityId, 'at multiChannelNodeId', this.capabilityMultiChannelNodeIdObj[capabilityId]);
          // registerCapability for the internal temperature sensor
          this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
            getOpts: { getOnStart: true },
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
                  if (this.getSetting('Temperature_thermostat') === subName) this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)']).catch(this.error);
                  return report['Sensor Value (Parsed)'];
                }
                if (report.Level.Scale === 1) {
                  if (this.getSetting('Temperature_thermostat') === subName) this.setCapabilityValue('measure_temperature', (report['Sensor Value (Parsed)'] - 32) / 1.8).catch(this.error);
                  return (report['Sensor Value (Parsed)'] - 32) / 1.8;
                }
              }
              return null;
            },
            multiChannelNodeId: this.capabilityMultiChannelNodeIdObj[capabilityId],
          });
        }
      }
    });

    if (this.hasCapability('measure_humidity')) {
      this.registerCapability('measure_humidity', 'SENSOR_MULTILEVEL',
        {
          getOpts: { getOnStart: true },
          multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['measure_humidity'],
        });
    }

    if (this.hasCapability('measure_battery')) {
      this.registerCapability('measure_battery', 'BATTERY',
        {
          getOpts: { getOnStart: true },
          multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['measure_battery'],
        });
    }

    if (this.hasCapability('meter_power')) this.registerCapability('meter_power', 'METER', { multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['meter_power'] });
    if (this.hasCapability('measure_power')) this.registerCapability('measure_power', 'METER', { multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['measure_power'] });
    if (this.hasCapability('measure_voltage')) this.registerCapability('measure_voltage', 'METER', { multiChannelNodeId: this.capabilityMultiChannelNodeIdObj['measure_voltage'] });

    if (this.hasCapability('button.reset_meter')) {
      // Listen for reset_meter maintenance action
      this.registerCapabilityListener('button.reset_meter', async () => {
        // Maintenance action button was pressed, return a promise
        if (typeof this.meterReset === 'function') return this.meterReset(this.capabilityMultiChannelNodeIdObj['button.reset_meter']);
        this.error('Reset meter failed');
        throw new Error('Reset meter not supported');
      });
    }
  }

  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
    await this.executeCapabilitySetCommand('thermostat_mode_single', 'THERMOSTAT_MODE', value ? 'Heat' : 'Off')
      .then(this.log('onoff set', value, value ? 'Heat' : 'Off'))
      .catch(this.error);
  }

  getCurrentSetpointValue() {
    let setpointType = Mode2Setpoint['Heat'];
    let currentSetpointValue = this.getStoreValue(`thermostatsetpointValue.${setpointType}`);
    return currentSetpointValue;
  }

  async onModeAutocomplete(query, args) {
    let resultArray = [];
    for (const modeID in Mode2Number) {
      resultArray.push({
        id: modeID,
        name: this.homey.__(`mode.${modeID}`),
        capability: 'thermostat_mode_single',
      });
    }

    // filter for query
    resultArray = resultArray.filter(result => {
      return result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
    });
    this.log(resultArray);
    return Promise.resolve(resultArray);
  }

}

module.exports = ThermostatTwoModeDevice;
