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

        if (this.hasCapability('thermofloor_onoff') === false) {
            await this.addCapability('thermofloor_onoff');
        }

        if (this.hasCapability('onoff')) {
            await this.removeCapability('onoff');
        }

        this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
        this.registerCapability('measure_battery', 'BATTERY');
        this.registerCapability('measure_humidity', 'SENSOR_MULTILEVEL');

        this.registerThermostatSetpointCapability();
        this.registerThermostatModeCapability();

        this.registerCapability('thermostat_state_IdleHeatCool', 'THERMOSTAT_OPERATING_STATE', {
            getOpts: { getOnStart: true },
            get: 'THERMOSTAT_OPERATING_STATE_GET',
            report: 'THERMOSTAT_OPERATING_STATE_REPORT',
            reportParser: report => {
                if (report?.Level?.['Operating State']) {
                    const state = report.Level['Operating State'];
                    const last = this.getStoreValue('lastThermostatState');
                    if (typeof state === 'string' && last !== state) {
                        this.driver.triggerThermostatState(this, { state }, { state });
                        this.setStoreValue('lastThermostatState', state).catch(this.error);
                    }
                    return state;
                }
                return null;
            },
        });

        this.registerCapability('thermofloor_onoff', 'THERMOSTAT_OPERATING_STATE', {
            get: 'THERMOSTAT_OPERATING_STATE_GET',
            getOpts: { getOnStart: true },
            report: 'THERMOSTAT_OPERATING_STATE_REPORT',
            reportParser: report => {
                const state = report?.Level?.['Operating State'];

                const thermofloorOnoffState = state === 'Heating' || state === 'Cooling';
                if (thermofloorOnoffState === 'Heating' || thermofloorOnoffState === 'Cooling') {
                    this.setCapabilityValue('thermofloor_onoff', true).catch(this.error);
                }
                if (state === 'Idle') {
                    this.setCapabilityValue('thermofloor_onoff', false).catch(this.error);
                }
                return thermofloorOnoffState !== this.getCapabilityValue('thermofloor_onoff')
                    ? thermofloorOnoffState
                    : null;
            },
        });
    }

    registerThermostatSetpointCapability() {
        this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
            getOpts: { getOnStart: true },

            getParser: () => {
                const modeCap = (this.getCapabilityValue('thermostat_mode') || 'heat').toLowerCase();
                const setpointType = Mode2Setpoint[modeCap] || 'Heating 1';
                return { Level: { 'Setpoint Type': setpointType } };
            },

            set: 'THERMOSTAT_SETPOINT_SET',

            setParserV3: value => {
                const modeCap = (this.getCapabilityValue('thermostat_mode') || 'heat').toLowerCase();
                const setpointType = Mode2Setpoint[modeCap] || 'Heating 1';
                const setpointSetting = Setpoint2Setting[setpointType];

                if (!setpointType || setpointType === 'not supported') return null;

                this.setStoreValue(`thermostatsetpointValue.${setpointType}`, value).catch(this.error);
                if (setpointSetting) this.setSettings({ [setpointSetting]: value * 10 }).catch(this.error);

                this._pendingSetpoint = { type: setpointType, value, expires: Date.now() + 2000 };
                this.setCapabilityValue('target_temperature', value).catch(this.error);

                const buf = Buffer.alloc(2);
                const scaled = (Math.round(value * 2) / 2 * 10) | 0;
                buf.writeUInt16BE(scaled);
                return {
                    Level: { 'Setpoint Type': setpointType },
                    Level2: { Size: 2, Scale: 0, Precision: 1 },
                    Value: buf,
                };
            },

            report: 'THERMOSTAT_SETPOINT_REPORT',

            reportParserV3: report => {
                if (!report?.Level2) return null;
                try {
                    const readVal = report.Value.readUIntBE(0, report.Level2.Size);
                    const val = readVal / (10 ** report.Level2.Precision);
                    const reportedType = report.Level['Setpoint Type'];
                    const modeCap = (this.getCapabilityValue('thermostat_mode') || 'heat').toLowerCase();
                    const expectedType = Mode2Setpoint[modeCap] || 'Heating 1';
                    // suppress stale reports during pending window
                    const pending = this._pendingSetpoint;
                    if (pending && reportedType === pending.type) {
                        if (Date.now() < pending.expires && Math.abs(val - pending.value) > 0.05) {
                            return null;
                        }
                        this._pendingSetpoint = null;
                    }
                    return reportedType === expectedType ? val : null;
                } catch (e) {
                    this.error('Error parsing setpoint report', e);
                    return null;
                }
            },
        });
    }

    registerThermostatModeCapability() {
        this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
            get: 'THERMOSTAT_MODE_GET',
            getOpts: { getOnStart: true },
            set: 'THERMOSTAT_MODE_SET',

            setParser: value => {
                if (!CapabilityToThermostatMode[value]) {
                    this.error('Invalid thermostat mode:', value);
                    return null;
                }
                const mode = CapabilityToThermostatMode[value];
                return { Level: { 'No of Manufacturer Data fields': 0, Mode: mode }, 'Manufacturer Data': Buffer.from([]) };
            },

            report: 'THERMOSTAT_MODE_REPORT',

            reportParser: report => {
                const mode = report?.Level?.Mode;
                if (ThermostatModeToCapability[mode]) {
                    if (mode === 'Off') {
                        this.setCapabilityValue('thermofloor_onoff', false).catch(this.error);
                    }
                    return ThermostatModeToCapability[mode];
                }
                return null;
            },
        });

        this.setAvailable().catch(err => this.error('Set available error', err));
    }
}

module.exports = ZTEMP3Device;
