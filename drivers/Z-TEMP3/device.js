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

        this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
        this.registerCapability('measure_battery', 'BATTERY');
        this.registerCapability('measure_humidity', 'SENSOR_MULTILEVEL');

        this.registerThermostatSetpointCapability();
        this.registerThermostatModeCapability();
        this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

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
    }

    async onCapabilityOnoff(value, opts) {

        if (value === true) {
            const previousMode = await this.getStoreValue('previousMode') || 'heat';
            await this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', previousMode).catch(this.error);
            await this.setCapabilityValue('thermostat_mode', previousMode).catch(this.error);
        } else {
            const currentMode = this.getCapabilityValue('thermostat_mode');
            if (currentMode !== 'off') await this.setStoreValue('previousMode', currentMode);
            await this.executeCapabilitySetCommand('thermostat_mode', 'THERMOSTAT_MODE', 'off').catch(this.error);
            await this.setCapabilityValue('thermostat_mode', 'off').catch(this.error);
        }
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
                    const capMode = ThermostatModeToCapability[mode];
                    return capMode;
                }
                this.error('Unknown mode report', report);
                return null;
            },
        });

        this.setAvailable().catch(err => this.error('Set available error', err));
    }
}

module.exports = ZTEMP3Device;
