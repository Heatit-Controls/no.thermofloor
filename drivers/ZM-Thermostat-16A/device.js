'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');

const CapabilityToThermostatMode = {
  'off': 'Off',
  'heat': 'Heat',
  'cool': 'Cool',
}

const ThermostatModeToCapability = {
  'Off': 'off',
  'Heat': 'heat',
  'Cool': 'cool',
}

class ZmThermostat16A extends ZwaveDevice {
  onNodeInit() {

    this.registerCapability('measure_power', 'METER');
    this.registerCapability('meter_power', 'METER');
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
    this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT');
    this.registerThermostatModeCapability();
  }

  registerThermostatModeCapability () {

    this.registerCapability('thermostat_mode_13570', 'THERMOSTAT_MODE', {
      get: 'THERMOSTAT_MODE_GET',
      getOpts: {
        getOnStart: true,
      },
      set: 'THERMOSTAT_MODE_SET',
      setParser: value => {
  
        this.log('THERMOSTAT_MODE_SET ', value)
        if (!CapabilityToThermostatMode.hasOwnProperty(value)) {
          return null
        }
        const mode = CapabilityToThermostatMode[value]
        if (typeof mode !== 'string') {
          return null
        }

        return {
          'Level': {
            'No of Manufacturer Data fields': 0,
            'Mode': mode,
          },
          'Manufacturer Data': Buffer.from([]),
        }
      },

      report: 'THERMOSTAT_MODE_REPORT',
      reportParser: report => {
  
        this.log('CONFIGURATION_REPORT ', report)
  
        if (report && report.hasOwnProperty('Level') && report['Level'].hasOwnProperty('Mode')) {
  
          const mode = report['Level']['Mode']

          if (typeof mode === 'string' && ThermostatModeToCapability.hasOwnProperty(mode)) {

            const capabilityMode = ThermostatModeToCapability[mode]
            this.log('Capability Mode ', capabilityMode)

            let isOff = capabilityMode === 'off'
            this.setCapabilityValue('onoff', !isOff).catch(this.error)
  
            return capabilityMode
          }
        }
  
        return null
      },
    });

    this.registerCapability('thermostat_state_13570', 'THERMOSTAT_OPERATING_STATE', {
      getOpts: {
        getOnStart: true,
      },
      get: 'THERMOSTAT_OPERATING_STATE_GET',
      report: 'THERMOSTAT_OPERATING_STATE_REPORT',
      reportParser: report => {
        if (report && report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Operating State')) {

          const state = report['Level']['Operating State']

          if (typeof state === 'string') {
            
            const thermostatStateObj = {
              state: state,
              state_name: this.homey.__(`state.${state}`),
            };

            this.homey.app.triggerThermostatStateChangedTo.trigger(this, null, thermostatStateObj);

            this.log('Operating State', state);
            
            return state;
          }
        }
        return null;
      }
    });
  }
}

module.exports = ZmThermostat16A;
