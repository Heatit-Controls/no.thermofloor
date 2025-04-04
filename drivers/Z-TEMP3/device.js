'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const Homey = require('homey');
const { Mode2Setpoint } = require('../../lib/map/ZTEMP3_mappings.js');
const { Setpoint2Setting } = require("../../lib/map/ZTEMP3_mappings");

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

        this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT');
        this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
        this.registerCapability('measure_battery', 'BATTERY');
        this.registerCapability('measure_humidity', 'SENSOR_MULTILEVEL');
        
        this.registerThermostatSetpointCapability();
        this.registerThermostatModeCapability();
        //add onoff capability to Z-Temp3 that are already paired
        if (this.hasCapability('onoff') === false) {
            await this.addCapability('onoff');
        }
        if (this.hasCapability('thermostat_state_13570') === true) {
            await this.removeCapability('thermostat_state_13570');
        }
        if (this.hasCapability('thermostat_state_IdleHeatCool') === false) {
            await this.addCapability('thermostat_state_IdleHeatCool');
        }

        //add thermostat class to Z-Temp3 that are already paired
        if (this.getClass() !== 'thermostat') {
            await this.setClass('thermostat').catch(this.error)
        }

        this.registerCapability('thermostat_state_IdleHeatCool', 'THERMOSTAT_OPERATING_STATE', {	
			getOpts: {
				getOnStart: true,
			},
			get: 'THERMOSTAT_OPERATING_STATE_GET',
			report: 'THERMOSTAT_OPERATING_STATE_REPORT',
			reportParser: report => {
				if (report?.Level?.['Operating State']) {
					const state = report.Level['Operating State'];
					if (typeof state === 'string') {
						const thermostatStateObj = {
							state,
							state_name: this.homey.__(`state.${state}`) || state,
						};
						this.log('thermostatStateObj', thermostatStateObj);
						
						this.driver.triggerThermostatState(this, { state }, { state });
						return state;
					}
				}
				return null;
			},
        });
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
        try {
            this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
                get: 'THERMOSTAT_MODE_GET',
                getOpts: {
                    getOnStart: true,
                },
                set: 'THERMOSTAT_MODE_SET',
                setParser: value => {
                    try {
                        if (!CapabilityToThermostatMode.hasOwnProperty(value)) {
                            throw new Error(`Invalid thermostat mode value: ${value}`);
                        }
                        const mode = CapabilityToThermostatMode[value];
                        return {
                            Level: {
                                'No of Manufacturer Data fields': 0,
                                Mode: mode,
                            },
                            'Manufacturer Data': Buffer.from([]),
                        };
                    } catch (error) {
                        this.error('Error in setParser for thermostat_mode:', error);
                        return null;
                    }
                },
                report: 'THERMOSTAT_MODE_REPORT',
                reportParser: report => {
                    try {
                        if (report && report.Level?.Mode) {
                            const mode = report.Level.Mode;
                            if (typeof mode === 'string' && ThermostatModeToCapability.hasOwnProperty(mode)) {
                                const capabilityMode = ThermostatModeToCapability[mode];
                                this.log('Capability Mode:', capabilityMode);
                                const currentOnoff = this.getCapabilityValue('onoff');
                                if (capabilityMode === 'heat' || capabilityMode === 'cool' || capabilityMode === 'energy save heat') {
                                    if (!currentOnoff) {
                                        this.setCapabilityValue('onoff', true).catch(this.error);
                                    }
                                }
                                if (capabilityMode === 'off') {
                                    if (currentOnoff) {
                                        this.setCapabilityValue('onoff', false).catch(this.error);
                                    }
                                }
                                return capabilityMode;
                            } else {
                                throw new Error(`Unknown or invalid mode reported: ${mode}`);
                            }
                        }
                        this.error('Invalid report structure for thermostat_mode:', report);
                        return null;
                    } catch (error) {
                        this.error('Error in reportParser for thermostat_mode:', error);
                        return null;
                    }
                },
            });
        } catch (error) {
            this.error('Error registering thermostat_mode capability:', error);
        }


            


        this.setAvailable().catch(error => this.error('Error setting device available:', error));
    }
}

module.exports = ZTEMP3Device;
