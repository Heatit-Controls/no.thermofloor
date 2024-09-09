'use strict';
const {ZwaveDevice} = require('homey-zwavedriver');
const Homey = require('homey');

const ThermostatFourModeDevice = require('../../lib/ThermostatFourModeDevice');
// Import Mode2Setpoint from mappings file
const { Mode2Setpoint } = require('../../lib/map/ZTEMP3_mappings.js');

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

let timer = null;

ZwaveDevice.setMaxListeners(20);


class ZTRM6Device extends ThermostatFourModeDevice {
    async onNodeInit() {

        this.capabilityMultiChannelNodeIdObj = {
            'measure_temperature.internal': 2,
            'measure_temperature.external': 3,
            'measure_temperature.floor': 4,
        };


        this.registerCapability('measure_power', 'METER');
        this.registerCapability('meter_power', 'METER');
        this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
        this.registerCapability('target_temp', 'THERMOSTAT_SETPOINT');

        let targetTempValue = await this.getCapabilityValue('target_temperature');
        this.setCapabilityValue('target_temperature', targetTempValue).catch(error => {
            console.error('Error setting target_temperature:', error);
        });

        

        await this.registerThermostatModeCapability();
        await this.registerTemperature();


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
                            if (report
                                && report.hasOwnProperty('Sensor Type')
                                && report['Sensor Type'] === 'Temperature (version 1)'
                                && report.hasOwnProperty('Sensor Value (Parsed)')
                                && report.hasOwnProperty('Level')
                                && report.Level.hasOwnProperty('Scale')) {
                                // Some devices send this when no temperature sensor is connected
                                if (report['Sensor Value (Parsed)'] === -999.9) return null;
                                this.log('+++++++ registerTemperature: ', capabilityId, '+++++++', report)
                                if (report.Level.Scale === 0) {
                                    if (capabilityId === 'measure_temperature.internal') {
                                        this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)']).catch(this.error);
                                    }
                                    return report['Sensor Value (Parsed)'];
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
                if (report && report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Mode')) {
                    const mode = report.Level.Mode;
                    if (typeof mode === 'string' && ThermostatModeToCapability.hasOwnProperty(mode)) {
                        const capabilityMode = ThermostatModeToCapability[mode];
                        this.log('Capability Mode ', capabilityMode);
                        return capabilityMode;
                    }
                }
                return null;
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
                    const state = report.Level['Operating State'];
                    if (typeof state === 'string') {
                        const thermostatStateObj = {
                            state: state,
                            state_name: this.homey.__(`state.${state}`),
                        };

                        this.homey.app.triggerThermostatStateChangedTo.trigger(this, null, thermostatStateObj);
                        this.setCapabilityValue('thermostat_state_13570', state).catch(this.error);
                        return state;
                    }
                }
                return null;
            },
        });

        this.setAvailable().catch(this.error);


    // Register the target temperature capability and setpoint types
    this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
        getOpts: {
            getOnStart: true,
        },
        getParser: () => {
            const thermostatMode = this.getCapabilityValue('thermostat_mode') || 'Heat';
            const setpointType = Mode2Setpoint[thermostatMode];

            // Fallback if setpointType is undefined
            if (!setpointType) {
                this.error(`Setpoint type for mode "${thermostatMode}" is undefined`);
                return null;
            }

            this.log('Current mode:', thermostatMode, 'Setpoint type:', setpointType);

            return {
                Level: {
                    'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
                },
            };
        },
        set: 'THERMOSTAT_SETPOINT_SET',
        setParserV3: setpointValue => {
            const thermostatMode = (this.getCapabilityValue('thermostat_mode') || 'heat').toLowerCase();
            const setpointType = Mode2Setpoint[thermostatMode];

            this.log('Current mode is:', thermostatMode, 'Mapped to Setpoint type:', setpointType);



            // Fallback if setpointType is undefined
            if (!setpointType) {
                this.error(`Setpoint type for mode "${thermostatMode}" is undefined`);
                return null;
            }

            this.log('Setting thermostat setpoint to:', setpointValue, 'for setpointType', setpointType);

            if (setpointType !== 'not supported') {
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
    });
}
}

module.exports = ZTRM6Device;
