'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const Homey = require('homey');
const { Mode2Setpoint, Setpoint2Setting } = require('../../lib/map/ZTEMP3_mappings.js');

const CapabilityToThermostatMode = {
  'off': 'Off',
  'heat': 'Heat',
  'cool': 'Cool',
  'energy save heat': 'Energy Save Heat',
};

const ThermostatModeToCapability = {
  'Off': 'off',
  'Heat': 'heat',
  'Cool': 'cool',
  'Energy Save Heat': 'energy save heat',
};

class ZTEMP3Device extends ZwaveDevice {
  async onNodeInit() {
    // this.enableDebug();
    // this.printNode();

    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
    this.registerCapability('measure_battery', 'BATTERY');
    this.registerCapability('measure_humidity', 'SENSOR_MULTILEVEL');

    // Register mode first so setpoint queries use the right type on start
    this.registerThermostatModeCapability();
    this.registerThermostatSetpointCapability();

    // Add onoff to already paired devices
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    // Ensure device class
    if (this.getClass() !== 'thermostat') {
      await this.setClass('thermostat').catch(this.error);
    }

    // Capability migrations
    if (this.hasCapability('thermostat_state_13570')) {
      await this.removeCapability('thermostat_state_13570');
    }
    if (!this.hasCapability('thermostat_state_IdleHeatCool')) {
      await this.addCapability('thermostat_state_IdleHeatCool');
    }

    this.registerCapability('thermostat_state_IdleHeatCool', 'THERMOSTAT_OPERATING_STATE', {
      getOpts: { getOnStart: true },
      get: 'THERMOSTAT_OPERATING_STATE_GET',
      report: 'THERMOSTAT_OPERATING_STATE_REPORT',
      reportParser: report => {
        const state = report?.Level?.['Operating State'];
        if (typeof state === 'string') {
          const lastThermostatState = this.getStoreValue('lastThermostatState');
          if (lastThermostatState !== state || lastThermostatState === null) {
            this.driver.triggerThermostatState(this, { state }, { state });
            this.setStoreValue('lastThermostatState', state).catch(this.error);
          }
          return state;
        }
        return null;
      },
    });
  }

  async onCapabilityOnoff(value, _opts) {
    if (value === true) {
      const previousMode = (await this.getStoreValue('previousMode')) || 'heat';
      await this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', previousMode)
        .then(this.log(`onoff set to ${previousMode}`))
        .catch(this.error);
      this.setCapabilityValue('thermostat_mode', previousMode);
    } else {
      const currentMode = this.getCapabilityValue('thermostat_mode');
      if (currentMode !== 'off') {
        await this.setStoreValue('previousMode', currentMode);
      }
      await this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', 'off')
        .then(this.log(`onoff set to 'off'`))
        .catch(this.error);
      this.setCapabilityValue('thermostat_mode', 'off');
    }
  }

  registerThermostatSetpointCapability() {
    this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
      getOpts: { getOnStart: true },

      getParser: () => {
        const capMode = this.getCapabilityValue('thermostat_mode');
        const zwaveMode = CapabilityToThermostatMode[capMode] || 'Heat';
        const spType = Mode2Setpoint[zwaveMode] || 'Heating 1';
        return {
          Level: {
            'Setpoint Type': spType !== 'not supported' ? spType : 'Heating 1',
          },
        };
      },

      set: 'THERMOSTAT_SETPOINT_SET',
      setParserV3: setpointValue => {
        const capMode = this.getCapabilityValue('thermostat_mode');
        const zwaveMode = CapabilityToThermostatMode[capMode] || 'Heat';
        const spType = Mode2Setpoint[zwaveMode] || 'Heating 1';
        const spSetting = Setpoint2Setting[spType];

        if (!spType || spType === 'not supported') return null;

        this.setStoreValue(`thermostatsetpointValue.${spType}`, setpointValue).catch(this.error);
        if (spSetting) {
          this.setSettings({ [spSetting]: setpointValue * 10 }).catch(this.error);
        }

        const buf = Buffer.alloc(2);
        const scaled = Number((Math.round(setpointValue * 2) / 2 * 10).toFixed(0));
        buf.writeUInt16BE(scaled);

        return {
          Level: { 'Setpoint Type': spType },
          Level2: { Size: 2, Scale: 0, Precision: 1 },
          Value: buf,
        };
      },

      report: 'THERMOSTAT_SETPOINT_REPORT',
      reportParserV3: report => {
        if (!report?.Level2 || report.Level2.Scale !== 0 || typeof report.Level2.Size === 'undefined') return null;

        let raw;
        try {
          raw = report.Value.readUIntBE(0, report.Level2.Size);
        } catch {
          return null;
        }
        const value = raw / 10 ** report.Level2.Precision;
        const reportedType = report.Level?.['Setpoint Type'];

        if (reportedType && reportedType !== 'not supported') {
          this.setStoreValue(`thermostatsetpointValue.${reportedType}`, value).catch(this.error);
          const spSetting = Setpoint2Setting[reportedType];
          if (spSetting) this.setSettings({ [spSetting]: value * 10 }).catch(this.error);
        }

        const capMode = this.getCapabilityValue('thermostat_mode');
        const zwaveMode = CapabilityToThermostatMode[capMode] || 'Heat';
        const expectedType = Mode2Setpoint[zwaveMode] || 'Heating 1';
        return reportedType === expectedType ? value : null;
      },
    });
  }

  registerThermostatModeCapability() {
    try {
      this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
        get: 'THERMOSTAT_MODE_GET',
        getOpts: { getOnStart: true },
        set: 'THERMOSTAT_MODE_SET',
        setParser: value => {
          try {
            if (!Object.prototype.hasOwnProperty.call(CapabilityToThermostatMode, value)) {
              throw new Error(`Invalid thermostat mode value: ${value}`);
            }
            const mode = CapabilityToThermostatMode[value];
            return {
              Level: { 'No of Manufacturer Data fields': 0, Mode: mode },
              'Manufacturer Data': Buffer.from([]),
            };
          } catch (err) {
            this.error('Error in setParser for thermostat_mode:', err);
            return null;
          }
        },
        report: 'THERMOSTAT_MODE_REPORT',
        reportParser: report => {
          try {
            const mode = report?.Level?.Mode;
            if (typeof mode === 'string' && Object.prototype.hasOwnProperty.call(ThermostatModeToCapability, mode)) {
              const capabilityMode = ThermostatModeToCapability[mode];

              const currentOnoff = this.getCapabilityValue('onoff');
              if (capabilityMode === 'off') {
                if (currentOnoff) this.setCapabilityValue('onoff', false).catch(this.error);
              } else {
                if (!currentOnoff) this.setCapabilityValue('onoff', true).catch(this.error);
              }

              return capabilityMode;
            }
            this.error('Unknown or invalid mode reported:', mode);
            return null;
          } catch (err) {
            this.error('Error in reportParser for thermostat_mode:', err);
            return null;
          }
        },
      });
    } catch (err) {
      this.error('Error registering thermostat_mode capability:', err);
    }

    this.setAvailable().catch(err => this.error('Error setting device available:', err));
  }
}

module.exports = ZTEMP3Device;
