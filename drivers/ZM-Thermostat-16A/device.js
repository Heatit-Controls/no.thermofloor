'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');
const { Mode2Setpoint } = require('../../lib/map/ZTEMP3_mappings.js');
const { Setpoint2Setting } = require("../../lib/map/ZTEMP3_mappings");

const CapabilityToThermostatMode = {
  'off': 'Off',
  'heat': 'Heat',
  'cool': 'Cool',
};

const ThermostatModeToCapability = {
  'Off': 'off',
  'Heat': 'heat',
  'Cool': 'cool',
};

class ZmThermostat16A extends ZwaveDevice {
  async onNodeInit() {
    this.registerCapability('measure_power', 'METER');
    this.registerCapability('meter_power', 'METER');
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
    this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT');

    if (this.hasCapability('thermostat_mode_13570')) {
      await this.removeCapability('thermostat_mode_13570');
    }
    //add onoff capability to existing systems
    if (this.hasCapability('thermostat_mode') === false) {
      await this.addCapability('thermostat_mode');
    }
    if (this.hasCapability('onoff') === false) {
      await this.addCapability('onoff');
    }

    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    this.registerThermostatModeCapability();
    this.registerThermostatSetpointCapability();

    this.thermostatModeChangedTrigger = this.homey.flow.getDeviceTriggerCard('thermostat_mode_changed');
    this.thermostatStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('thermostat_state_changed');

    // Listen for reset_meter maintenance action
    this.registerCapabilityListener('button.reset_meter', async () => {
      let commandClassMeter = null;
      commandClassMeter = this.getCommandClass('METER');
      if (commandClassMeter && commandClassMeter.hasOwnProperty('METER_RESET')) {
        const result = await commandClassMeter.METER_RESET({});
        if (result !== 'TRANSMIT_COMPLETE_OK') throw result;
      }
      else {
        throw new Error('Reset meter not supported');
      }
    });

    if (this.hasCapability('meter_power')) this.registerCapability('meter_power', 'METER');
    if (this.hasCapability('measure_power')) this.registerCapability('measure_power', 'METER');

    this.log('ZM-Dimmer has been initialized');

    this.setAvailable().catch(this.error);
  }

  async onCapabilityOnoff(value, opts) {
    if (value === true) {
      const previousMode = await this.getStoreValue('previousMode') || 'heat';

      await this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', previousMode)
        .then(this.log(`onoff set to ${previousMode}`))
        .catch(this.error);

      this.setCapabilityValue('thermostat_mode', previousMode);
    }

    if (value === false) {
      const currentMode = this.getCapabilityValue('thermostat_mode');
      if (currentMode !== 'off') {
        await this.setStoreValue('previousMode', currentMode);
        this.log(`Stored previous mode: ${currentMode}`);
      }

      await this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', 'off')
        .then(this.log(`onoff set to 'off'`))
        .catch(this.error);

      this.setCapabilityValue('thermostat_mode', 'off');
    }
  }

  registerThermostatSetpointCapability() {
    this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
      getOpts: {
        getOnStart: true,
      },
      getParser: () => {
        // Retrieve the setpointType based on the current thermostat_mode
        const currentMode = this.getCapabilityValue('thermostat_mode') || 'Heat';
        const setpointType = Mode2Setpoint[currentMode] || 'Heating 1'; // fallback
        return {
          Level: {
            'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
          },
        };
      },
      set: 'THERMOSTAT_SETPOINT_SET',
      setParserV3: setpointValue => {
        const currentMode = this.getCapabilityValue('thermostat_mode') || 'Heat';
        const setpointType = Mode2Setpoint[currentMode];
        this.log('Mode2Setpoint ->', setpointValue, currentMode, setpointType);

        if (setpointType !== 'not supported' && setpointType) {
          this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);

          const setpointSetting = Setpoint2Setting[setpointType];
          this.setSettings({
            [setpointSetting]: setpointValue * 10,
          }).catch(this.error);

          const bufferValue = Buffer.alloc(2);
          const scaled = (Math.round(setpointValue * 2) / 2 * 10).toFixed(0);
          bufferValue.writeUInt16BE(scaled);

          this.log(
            `Set thermostat setpointValue: ${setpointValue}, scaled to: ${scaled}, buffer:`,
            bufferValue
          );
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
        this.log('reportParserV3 thermostat setpoint report:', report);
        if (
          report &&
          report.hasOwnProperty('Level2') &&
          report.Level2.hasOwnProperty('Scale') &&
          report.Level2.hasOwnProperty('Precision') &&
          report.Level2.Scale === 0 &&
          typeof report.Level2.Size !== 'undefined'
        ) {
          let readValue;
          try {
            readValue = report.Value.readUIntBE(0, report.Level2.Size);
          } catch (err) {
            return null;
          }
          if (typeof readValue !== 'undefined') {
            const setpointValue = readValue / 10 ** report.Level2.Precision;
            const setpointType = report.Level['Setpoint Type'];
            this.log('Received setpoint report:', setpointType, setpointValue);

            if (setpointType !== 'not supported') {
              this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);
            }
            const setpointSetting = Setpoint2Setting[setpointType];
            this.setSettings({
              [setpointSetting]: setpointValue * 10,
            }).catch(this.error);

            // Only update the UI if the current mode matches the type
            const currentMode = this.getCapabilityValue('thermostat_mode') || 'Heat';
            if (setpointType === Mode2Setpoint[currentMode]) {
              this.log('Updated thermostat setpoint on UI to', setpointValue);
              return setpointValue;
            }
            return null;
          }
        }
        return null;
      }
    });
  }

  registerThermostatModeCapability() {
    // Register the thermostat mode capability
    this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
      get: 'THERMOSTAT_MODE_GET',
      getOpts: {
        getOnStart: true,
      },
      set: 'THERMOSTAT_MODE_SET',
      setParser: (value) => {
        this.log('THERMOSTAT_MODE_SET', value);
        if (!CapabilityToThermostatMode.hasOwnProperty(value)) {
          return null;
        }
        const mode = CapabilityToThermostatMode[value];
        if (typeof mode !== 'string') {
          return null;
        }

        return {
          Level: {
            'No of Manufacturer Data fields': 0,
            Mode: mode,
          },
          'Manufacturer Data': Buffer.from([]),
        };
      },
      report: 'THERMOSTAT_MODE_REPORT',
      reportParser: (report) => {
        this.log('THERMOSTAT_MODE_REPORT', report);
        if (report && report.Level?.Mode) {
          const mode = report.Level.Mode;
          if (typeof mode === 'string' && ThermostatModeToCapability.hasOwnProperty(mode)) {
            const capabilityMode = ThermostatModeToCapability[mode];
            this.log('Capability Mode', capabilityMode);
            if (typeof capabilityMode === 'string') {
              if (capabilityMode === 'heat' || capabilityMode === 'cool') {
                this.setCapabilityValue('onoff', true).catch(this.error);
              }

              if (capabilityMode === 'off') {
                this.setCapabilityValue('onoff', false).catch(this.error);
              }

              this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', capabilityMode).catch(this.error);

              let stringMode = String(capabilityMode);

              this.thermostatModeChangedTrigger.trigger(this, { thermostat_mode: stringMode }).catch(this.error);

              return capabilityMode;
            }
          }
        }
        return null;
      },
    });

    this.registerCapabilityListener('thermostat_mode', async (mode) => {
      if (mode === 'heat' || mode === 'cool') {
        await this.setCapabilityValue('onoff', true).catch(this.error);
      }

      if (mode === 'off') {
        await this.setCapabilityValue('onoff', false).catch(this.error);
      }

      await this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', mode).catch(this.error);

      let stringMode = String(mode);

      this.thermostatModeChangedTrigger.trigger(this, { thermostat_mode: stringMode }).catch(this.error);
      return mode;
    });

    this.registerCapability('thermostat_state_13570', 'THERMOSTAT_OPERATING_STATE', {
      getOpts: {
        getOnStart: true,
      },
      get: 'THERMOSTAT_OPERATING_STATE_GET',
      report: 'THERMOSTAT_OPERATING_STATE_REPORT',
      reportParser: (report) => {
        if (report && report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Operating State')) {
          const state = report.Level['Operating State'];
          if (typeof state === 'string') {
            /* const thermostatStateObj = {
               state: state,
               state_name: this.homey.__(`state.${state}`),
             };
 
             this.homey.app.triggerThermostatStateChangedTo.trigger(this, null, thermostatStateObj);*/
            this.thermostatStateChangedTrigger.trigger(this, { thermostat_state: state });
            this.log('Operating State', state);
            return state;
          }
        }
        return null;
      },
    });
  }
}

module.exports = ZmThermostat16A;
