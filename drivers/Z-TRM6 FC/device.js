'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const Homey = require('homey');

const ThermostatFourModeDevice = require('../../lib/ThermostatFourModeDevice');
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

const CapabilityToFanMode = {
	'low': 'Low',
	'medium': 'Medium',
	'high': 'High',
	'auto medium' : 'Auto Medium'
  };
  
  const FanModeToCapability = {
	'Low': 'low',
	'Medium': 'medium',
	'High': 'high',
	'Auto Medium': 'auto medium',
  };

ZwaveDevice.setMaxListeners(20);

class ZTRM6FCDevice extends ThermostatFourModeDevice {
	async onNodeInit() {
		this.log('Initializing Z-TRM6 FC device...');
		this.enableDebug();

		this.registerCapability('meter_power', 'METER');
		this.registerCapability('measure_power', 'METER');

		this.registerCapability('thermostat_fan_mode', 'THERMOSTAT_FAN_MODE', {
			get: 'THERMOSTAT_FAN_MODE_GET',
			getOpts: { 
				getOnStart: true 
			},

			set: 'THERMOSTAT_FAN_MODE_SET',
			setParser: value => {
				const normalizedValue = value.toLowerCase();
				if (!CapabilityToFanMode.hasOwnProperty(normalizedValue)) return null;
				const fanMode = CapabilityToFanMode[normalizedValue];
				if (typeof fanMode !== 'string') return null;
			  
				const payload = {
				  Level: {
					'No of Manufacturer Data fields': 0,
					'Fan Mode': fanMode,
				  },
				  'Manufacturer Data': Buffer.from([]),
				};
			  
				this.log('Sending fan mode payload:', JSON.stringify(payload));
				return payload;
			  },

			  
			report: 'THERMOSTAT_FAN_MODE_REPORT',
			reportParser: report => {
				this.log('Fan mode report:', report);
				if (report && report.Level && report.Level.Mode) {
					const mode = report.Level.Mode;
					if (typeof mode === 'string' && FanModeToCapability.hasOwnProperty(mode)) {
						const capabilityFanMode = FanModeToCapability[mode];
						this.log('Capability Mode', capabilityFanMode);
						return capabilityFanMode;
					}
				}
				return null;
			},
		});

		  


		this.registerCapability('fan_state', 'THERMOSTAT_FAN_STATE', {
			get: 'THERMOSTAT_FAN_STATE_GET',
			report: 'THERMOSTAT_FAN_STATE_REPORT',
			reportParser: report => {
				this.log('Fan state report:', report);
				if (report && report.Level && report.Level['Fan State']) {
					const state = report.Level['Fan State'];
					if (FanStateToCapability.hasOwnProperty(state)) {
						return FanStateToCapability[state];
					}
				}
				return null;
			},
		});


		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: { getOnStart: true },
			report: 'SENSOR_MULTILEVEL_REPORT',
			reportParser: report => {
				if (
					report &&
					report.hasOwnProperty('Sensor Type') &&
					report['Sensor Type'] === 'Temperature (version 1)' &&
					report.hasOwnProperty('Sensor Value (Parsed)') &&
					report.hasOwnProperty('Level') &&
					report.Level.hasOwnProperty('Scale')
				) {
					// Some devices send this when no sensor is connected
					if (report['Sensor Value (Parsed)'] === -999.9) return null;
					if (report.Level.Scale === 0) {
						this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)'])
							.catch(this.error);
						return report['Sensor Value (Parsed)'];
					}
				}
				return null;
			},
		});
	

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
					// Store thermostat setpoint based on thermostat type
					this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);

					// Update device settings setpoint value
					const setpointSetting = Setpoint2Setting[setpointType];
					this.setSettings({
						[setpointSetting]: setpointValue * 10,
					}).catch(this.error);

					// Prepare the buffer
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
			},
		});


		// Register thermostat mode and temperature capabilities
		await this.registerThermostatModeCapability();

		this.log('Z-TRM6 FC has been initialized');
		this.setAvailable().catch(this.error);
	}


	registerThermostatModeCapability() {
		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: { getOnStart: true },
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => {
				if (!CapabilityToThermostatMode.hasOwnProperty(value)) return null;
				const mode = CapabilityToThermostatMode[value];
				if (typeof mode !== 'string') return null;
				return {
					Level: {
						'No of Manufacturer Data fields': 0,
						'Mode': mode,
					},
					'Manufacturer Data': Buffer.from([]),
				};
			},
			report: 'THERMOSTAT_MODE_REPORT',
			reportParser: report => {
				this.log('Thermostat mode report:', report);
				if (report && report.Level && report.Level.Mode) {
					const mode = report.Level.Mode;
					if (typeof mode === 'string' && ThermostatModeToCapability.hasOwnProperty(mode)) {
						const capabilityMode = ThermostatModeToCapability[mode];
						this.log('Capability Mode', capabilityMode);
						return capabilityMode;
					}
				}
				return null;
			},
		});

		// Thermostat operating state
		this.registerCapability('thermostat_state_13570', 'THERMOSTAT_OPERATING_STATE', {
			getOpts: { getOnStart: true },
			get: 'THERMOSTAT_OPERATING_STATE_GET',
			report: 'THERMOSTAT_OPERATING_STATE_REPORT',
			reportParser: report => {
				this.log('THERMOSTAT_OPERATING_STATE report:', report);
				if (report && report.Level && report.Level['Operating State']) {
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
	}
}

module.exports = ZTRM6FCDevice;
