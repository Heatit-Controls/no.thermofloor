'use strict';
const {ZwaveDevice} = require('homey-zwavedriver');
const Homey = require('homey');

const ThermostatFourModeDevice = require('../../lib/ThermostatFourModeDevice');
// Import Mode2Setpoint from mappings file
const { Mode2Setpoint } = require('../../lib/map/ZTEMP3_mappings.js');
const {Setpoint2Setting} = require("../../lib/map/ZTEMP3_mappings");

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



        // this.registerCapability('measure_power', 'METER', {
        //     report: 'METER_REPORT',
        //     reportParserV5: report => {
        //         const bool = report && report.hasOwnProperty('Properties2')
        //             && report.Properties2['Scale bits 10'] === 2
        //         this.log("measure_power" , bool)
        //         if (bool) {
        //             this.log("measure_power" , report['Meter Value (Parsed)'])
        //             return report['Meter Value (Parsed)'];
        //         }
        //         return 0
        //     },
        //     multiChannelNodeId: 1,
        // });
        // this.registerCapability('meter_power', 'METER', {
        //     report: 'METER_REPORT',
        //     reportParserV5: report => {
        //         const bool = report && report.hasOwnProperty('Properties2')
        //             && report.Properties2['Scale bits 10'] === 0
        //         this.log("meter_power" , bool)
        //         if (bool) {
        //             this.log("meter_power" , report['Meter Value (Parsed)'])
        //             return report['Meter Value (Parsed)'];
        //         }
        //         return 0
        //     },
        //     multiChannelNodeId: 1,
        // });

        this.registerMultiChannelReportListener(1, "METER", "METER_REPORT", report => {
            const bool = report && report.hasOwnProperty('Properties2')
            this.log("METER_REPORT" , report)
            if (bool && report.Properties2['Scale bits 10'] === 0) {
                this.log("meter_power" , report['Meter Value (Parsed)'])
                this.setCapabilityValue('meter_power', report['Meter Value (Parsed)']).catch(this.error);

            } else if (bool && report.Properties2['Scale bits 10'] === 2) {
                this.log("measure_power" , report['Meter Value (Parsed)'])
                this.setCapabilityValue('measure_power', report['Meter Value (Parsed)']).catch(this.error);
            }
        })


        this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

        this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
            getOpts: {
                getOnStart: true,
            },
            getParser: () => {
                // 1. Retrieve the setpointType based on the thermostat mode
                const setpointType = Mode2Setpoint[this.getCapabilityValue('thermostat_mode') || 'Heat'];

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
                this.log('Mode2Setpoint', setpointValue, this.getCapabilityValue('thermostat_mode'), Mode2Setpoint[this.getCapabilityValue('thermostat_mode') || 'Heat']);
                const setpointType = Mode2Setpoint[this.getCapabilityValue('thermostat_mode') || 'Heat'];

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
                this.log('reportParserV3 thermostat setpoint report:', report);
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
                        if (setpointType === Mode2Setpoint[this.getCapabilityValue('thermostat_mode') || 'Heat']) {
                            this.log('Updated thermostat setpoint on UI to', setpointValue);
                            return setpointValue;
                        }

                        return null;
                    }
                    return null;
                }
                return null;
            },
            multiChannelNodeId: 1,
        });





        await this.registerThermostatModeCapability();
        await this.registerTemperature();


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
                            const temperatureMap = {
                                'measure_temperature.external': 3,
                                'measure_temperature.floor': 0,
                                'measure_temperature.internal': 1
                            };
                        
                            if (report
                                && report.hasOwnProperty('Sensor Type')
                                && report['Sensor Type'] === 'Temperature (version 1)'
                                && report.hasOwnProperty('Sensor Value (Parsed)')
                                && report.hasOwnProperty('Level')
                                && report.Level.hasOwnProperty('Scale')) {
                        
                                // Some devices send this when no temperature sensor is connected
                                if (report['Sensor Value (Parsed)'] === -999.9) return null;
                        
                                if (report.Level.Scale === 0) {
                                    this.configurationGet({ index: 2 })
                                        .then(Sensor => {
                                            if (Sensor && Sensor['Configuration Value'] && Buffer.isBuffer(Sensor['Configuration Value'])) {
                                                const configValue = Sensor['Configuration Value'].readUIntBE(0, Sensor['Level'].Size); // Read buffer value based on size
                                                //this.log(`Parameter 2 actual value: ${configValue}`);
                                                
                                                // Check if configValue matches any value in temperatureMap
                                                const matchedCapability = Object.keys(temperatureMap).find(key => temperatureMap[key] === configValue);
                                                
                                                if (matchedCapability && capabilityId === matchedCapability) {
                                                    this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)']).catch(this.error);
                                                }
                                            }
                                        })
                                        .catch(this.error);
                        
                                    return report['Sensor Value (Parsed)'];
                                }
                            }
                            return null;
                        }
                        ,
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
                this.log('Thermostat mode report:', report);
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
            multiChannelNodeId: 1,
        });
        this.registerCapability('thermostat_state_13570', 'THERMOSTAT_OPERATING_STATE', {
            getOpts: {
                getOnStart: true,
            },
            get: 'THERMOSTAT_OPERATING_STATE_GET',
            report: 'THERMOSTAT_OPERATING_STATE_REPORT',
            reportParser: report => {
                this.log('THERMOSTAT_OPERATING_STATE report:', report);
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
            multiChannelNodeId: 1,
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
