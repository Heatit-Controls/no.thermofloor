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

        this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
        this.registerCapability('measure_battery', 'BATTERY');
        this.registerCapability('measure_humidity', 'SENSOR_MULTILEVEL');

        this.registerThermostatSetpointCapability();
        this.registerThermostatModeCapability();
        this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

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
                        const lastThermostatState = this.getStoreValue('lastThermostatState');
                        if (lastThermostatState !== state || lastThermostatState === null) {
                            this.driver.triggerThermostatState(this, { state }, { state });
                            this.setStoreValue('lastThermostatState', state).catch(this.error);
                        }
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
                .catch(this.error);
            await this.setCapabilityValue('thermostat_mode', previousMode).catch(this.error);
        }

        if (value === false) {
            const currentMode = this.getCapabilityValue('thermostat_mode');
            if (currentMode !== 'off') {
                await this.setStoreValue('previousMode', currentMode);
            }

            await this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', 'off')
                .catch(this.error);
            await this.setCapabilityValue('thermostat_mode', 'off').catch(this.error);
        }
    }


    registerThermostatSetpointCapability() {
        this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
            getOpts: { getOnStart: true },

            // Always compute the correct setpoint type for the current thermostat_mode
            getParser: () => {
                const modeCap = (this.getCapabilityValue('thermostat_mode') || 'heat').toLowerCase();
                const setpointType = Mode2Setpoint[modeCap] || 'Heating 1';
                return { Level: { 'Setpoint Type': setpointType } };
            },

            set: 'THERMOSTAT_SETPOINT_SET',

            setParserV3: setpointValue => {
                const modeCap = (this.getCapabilityValue('thermostat_mode') || 'heat').toLowerCase();
                const setpointType = Mode2Setpoint[modeCap] || 'Heating 1';
                const setpointSetting = Setpoint2Setting[setpointType];

                if (!setpointType || setpointType === 'not supported') return null;

                this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);
                if (setpointSetting) {
                    this.setSettings({ [setpointSetting]: setpointValue * 10 }).catch(this.error);
                }

                const bufferValue = Buffer.alloc(2);
                const scaled = (Math.round(setpointValue * 2) / 2 * 10) | 0;
                bufferValue.writeUInt16BE(scaled);

                return {
                    Level: { 'Setpoint Type': setpointType },
                    Level2: { Size: 2, Scale: 0, Precision: 1 },
                    Value: bufferValue,
                };
            },

            report: 'THERMOSTAT_SETPOINT_REPORT',

            reportParserV3: report => {
                if (!report?.Level2 || report.Level2.Scale === undefined || report.Level2.Precision === undefined) {
                    return null;
                }

                let readValue;
                try {
                    readValue = report.Value.readUIntBE(0, report.Level2.Size);
                } catch (err) {
                    this.error('Error reading report.Value:', err);
                    return null;
                }

                if (readValue === undefined) return null;

                const setpointValue = readValue / (10 ** report.Level2.Precision);
                const reportedType = report.Level['Setpoint Type'];

                const modeCap = (this.getCapabilityValue('thermostat_mode') || 'heat').toLowerCase();
                const expectedType = Mode2Setpoint[modeCap] || 'Heating 1';
                const setpointSetting = Setpoint2Setting[reportedType];

                if (reportedType && reportedType !== 'not supported') {
                    this.setStoreValue(`thermostatsetpointValue.${reportedType}`, setpointValue)
                        .catch(this.error);
                }

                if (setpointSetting) {
                    this.setSettings({ [setpointSetting]: setpointValue * 10 })
                        .catch(this.error);
                }

                // Update UI only when the report matches the active mode’s setpoint type
                if (reportedType === expectedType) {
                    return setpointValue; // ← updates target_temperature
                }

                return null;
            },
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
                                const currentOnoff = this.getCapabilityValue('onoff');

                                const shouldBeOn = (capabilityMode === 'heat' || capabilityMode === 'cool' || capabilityMode === 'energy save heat');
                                if (shouldBeOn && !currentOnoff) this.setCapabilityValue('onoff', true).catch(this.error);
                                if (!shouldBeOn && currentOnoff) this.setCapabilityValue('onoff', false).catch(this.error);

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
