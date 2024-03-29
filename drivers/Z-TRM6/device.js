'use strict';
const {ZwaveDevice} = require('homey-zwavedriver');
const Homey = require('homey');

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

let timer = null;

ZwaveDevice.setMaxListeners(20);


class ZTRM6Device extends ZwaveDevice {
    async onNodeInit() {

        this.capabilityMultiChannelNodeIdObj = {
            'measure_temperature.internal': 2,
            'measure_temperature.external': 3,
            'measure_temperature.floor': 4,
        };


        this.registerCapability('measure_power', 'METER');
        this.registerCapability('meter_power', 'METER');
        this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
        this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT');


        await this.registerThermostatModeCapability();
        await this.registerTemperature();

        timer = this.homey.setInterval(() => {
            this.registerTemperature();
        }, 1000 * 60)


        this.log('Z-TRM6 has been initialized');

        this.setAvailable().catch(this.error);
    }

    onDeleted() {
        this.homey.clearInterval(timer)
        super.onDeleted();
    }

    async registerTemperature() {
        Object.keys(this.capabilityMultiChannelNodeIdObj).forEach(capabilityId => {
            if (capabilityId.includes('measure_temperature')) {
                const subName = capabilityId.split('.')[1];

                // register main measure_temperature capability
                if (this.hasCapability(capabilityId) && subName === undefined) {
                    // registerCapability for the internal temperature sensor
                    this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
                        getOpts: {getOnStart: true},
                        multiChannelNodeId: this.capabilityMultiChannelNodeIdObj[capabilityId],
                    });
                } else if (this.hasCapability(capabilityId) && subName !== undefined) {
                    // registerCapability for the internal temperature sensor
                    this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
                        getOpts: {getOnStart: true},
                        report: 'SENSOR_MULTILEVEL_REPORT',
                        reportParser: report => {
                            /* if (report
                                && report.hasOwnProperty('Sensor Type')
                                && report['Sensor Type'] === 'Temperature (version 1)'
                                && report.hasOwnProperty('Sensor Value (Parsed)')
                                && report.hasOwnProperty('Level')
                                && report.Level.hasOwnProperty('Scale')) {
                                // Some devices send this when no temperature sensor is connected
                                if (report['Sensor Value (Parsed)'] === -999.9) return null;
                                this.log('+++++++ registerTemperature:', capabilityId, '+++++++', report)
                                if (report.Level.Scale === 0) {
                                    if (capabilityId === 'measure_temperature.internal') {
                                        this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)']).catch(this.error);
                                    }
                                    return report['Sensor Value (Parsed)'];
                                }
                            }
                            return null; */

                            if(report && report.hasOwnProperty('Sensor Value (Parsed)')){
                                if(report['Sensor Value (Parsed)'] === -999.9) return null;
                
                                if(report.Level.Scale === 0){
                                  const temperatureValue = report['Sensor Value (Parsed)'];
                                  this.log('Received Z-TRM6 temperature', subName, 'value:', temperatureValue);
                                  this.setCapabilityValue(capabilityId, temperatureValue).catch(this.error);
                                  return temperatureValue;
                                }
                            }
                            return null;
                        },
                        multiChannelNodeId: this.capabilityMultiChannelNodeIdObj[capabilityId],
                    });
                }
            }
        });
    }

    registerThermostatModeCapability() {
        this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
            get: 'THERMOSTAT_MODE_GET',
            getOpts: {
                getOnStart: true,
            },
            set: 'THERMOSTAT_MODE_SET',
            setParser: value => {

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

                if (report && report.hasOwnProperty('Level') && report['Level'].hasOwnProperty('Mode')) {

                    const mode = report['Level']['Mode']

                    if (typeof mode === 'string' && ThermostatModeToCapability.hasOwnProperty(mode)) {

                        const capabilityMode = ThermostatModeToCapability[mode]
                        this.log('Capability Mode ', capabilityMode)

                        let isOff = capabilityMode === 'off'
                        // this.setCapabilityValue('onoff', !isOff).catch(this.error)

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
                            state_name: this.homey.__(`state.${ state }`),
                        };

                        this.homey.app.triggerThermostatStateChangedTo.trigger(this, null, thermostatStateObj);


                        return state;
                    }
                }
                return null;
            }
        });
    }
}

module.exports = ZTRM6Device;
