'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const Homey = require('homey');
const { Mode2Setpoint } = require('../../lib/map/ZTEMP3_mappings.js');
const { Setpoint2Setting } = require("../../lib/map/ZTEMP3_mappings");

class ZTRM6FCDevice extends ZwaveDevice {
	constructor(...args) {
		super(...args);
		
		// Define constants as class properties
		this.CapabilityToThermostatMode = {
			'off': 'Off',
			'heat': 'Heat',
			'cool': 'Cool',
			'energy save heat': 'Energy Save Heat',
			'auto': 'Auto',
			'fan': 'Fan Only',
		};

		this.ThermostatModeToCapability = {
			'Off': 'off',
			'Heat': 'heat',
			'Cool': 'cool',
			'Energy Save Heat': 'energy save heat',
			'Auto': 'auto',
			'Fan Only': 'fan',
		};
		
		// Fan mode mappings
		this.CapabilityToFanMode = {
			// Only keep the capitalized versions that match the driver.compose.json
			'Low': "Low",
			'Medium': "Medium", 
			'High': "High",
			'Auto Medium': "Auto Medium",
			'Circulation': "Circulation"
		};
		
		this.FanModeToCapability = {
			'Auto Medium': "Auto Medium",
			'Medium': "Medium",
			'Low': "Low",
			'High': "High",
			'Circulation': "Circulation"
		};
	}
	
	async onNodeInit() {
		// enable debug logging
		this.enableDebug();
		

		// print the node's info to the console
		// this.printNode();
		
		// register capabilities for this device

		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
		});

		this.registerCapability('meter_power', 'METER', {
			getOpts: {
				getOnStart: true,
			},
		});
		this.registerCapability('measure_power', 'METER', {
			getOpts: {
				getOnStart: true,
			},
		});
		this.registerCapability('fan_mode', 'THERMOSTAT_FAN_MODE', {
			getOpts: {
				getOnStart: true,
			},
			get: 'THERMOSTAT_FAN_MODE_GET',
			set: 'THERMOSTAT_FAN_MODE_SET',
			setParser: fanMode => {
				this.log('Setting fan mode to:', fanMode);
				
				// Get the Z-Wave fan mode value from the capability value
				const zwaveFanMode = this.CapabilityToFanMode[fanMode];
				if (!zwaveFanMode) {
					this.log('Invalid fan mode:', fanMode);
					return null;
				}
			
				try {
					return {
						Properties1: {
							Off: false,
							'Fan Mode': zwaveFanMode,
						},
						'Manufacturer Data': Buffer.from([0]),
					};
				} catch (err) {
					this.error(`Error creating fan mode command: ${err.message}`);
					return null;
				}
			},
			report: 'THERMOSTAT_FAN_MODE_REPORT',
			reportParser: report => {
				this.log('THERMOSTAT_FAN_MODE report:', report);
				if (!report) return null;
				
				try {
					if (report.hasOwnProperty('Properties1') && report.Properties1.hasOwnProperty('Fan Mode')) {
						const zwaveFanMode = report.Properties1['Fan Mode'];
						this.log('Received fan mode report:', zwaveFanMode);
						
						// Convert Z-Wave fan mode to capability value
						const fanMode = this.FanModeToCapability[zwaveFanMode];
						if (!fanMode) {
							this.log('Unknown fan mode received:', zwaveFanMode);
							return null;
						}
											
						return fanMode;
					}
				} catch (err) {
					this.error(`Error processing fan mode report: ${err.message}`);
				}
				return null;
			},
		});

		this.registerCapability('thermostat_fan_state', 'THERMOSTAT_FAN_STATE', {
			getOpts: {
				getOnStart: true,
			},
			get: 'THERMOSTAT_FAN_STATE_GET',
			report: 'THERMOSTAT_FAN_STATE_REPORT',
			reportParser: report => {
				this.log('THERMOSTAT_FAN_STATE report:', report);
				try {
					if (report && report.Properties1 && report.Properties1['Fan Operating State']) {
						const state = report.Properties1['Fan Operating State'];
						
						if (typeof state === 'string') {
							this.log('Fan state:', state);
							return state;
						}
					} else if (report && report.Level && report.Level['Fan Operating State']) {
						// Handle the new format where the state is in Level instead of Properties1
						const state = report.Level['Fan Operating State'];
						
						if (typeof state === 'string') {
							this.log('Fan state (from Level):', state);
							return state;
						}
					}
				} catch (err) {
					this.error(`Error processing fan state report: ${err.message}`);
				}
				return null;
			},
		});
		
		
		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: {
				getOnStart: true,
			},
			getParser: () => {
				try {
					// Retrieve the setpointType based on the current thermostat_mode
					const currentMode = this.getCapabilityValue('thermostat_mode') || 'Heat';
					const setpointType = Mode2Setpoint[currentMode] || 'Heating 1'; // fallback
					
					if (!setpointType) {
						this.error(`No setpoint type found for mode: ${currentMode}`);
						return {
							Level: {
								'Setpoint Type': 'Heating 1', // Default fallback
							},
						};
					}
					
					return {
						Level: {
							'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
						},
					};
				} catch (err) {
					this.error(`Error in target_temperature getParser: ${err.message}`);
					// Return a safe default
					return {
						Level: {
							'Setpoint Type': 'Heating 1',
						},
					};
				}
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
					if (!setpointSetting) {
						this.error(`No matching setting found for setpoint type: ${setpointType}`);
						return null;
					}
					
					this.setSettings({
						[setpointSetting]: setpointValue * 10,
					}).catch(this.error);

					// Prepare the buffer
					const bufferValue = Buffer.alloc(2);
					try {
						const scaled = (Math.round(setpointValue * 2) / 2 * 10).toFixed(0);
						bufferValue.writeUInt16BE(parseInt(scaled, 10));

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
					} catch (err) {
						this.error(`Error creating buffer for setpoint value: ${err.message}`);
						return null;
					}
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
					typeof report.Level2.Size !== 'undefined' &&
					report.Value && Buffer.isBuffer(report.Value) &&
					report.Value.length >= report.Level2.Size
				) {
					let readValue;
					try {
						readValue = report.Value.readUIntBE(0, report.Level2.Size);
					} catch (err) {
						this.error(`Error reading setpoint value: ${err.message}`);
						return null;
					}
					if (typeof readValue !== 'undefined') {
						const setpointValue = readValue / 10 ** report.Level2.Precision;
						const setpointType = report.Level && report.Level['Setpoint Type'];
						if (!setpointType) {
							this.error('Missing Setpoint Type in report');
							return null;
						}
						
						this.log('Received setpoint report:', setpointType, setpointValue);

						if (setpointType !== 'not supported') {
							this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue)
								.catch(err => this.error(`Error storing setpoint value: ${err.message}`));
						}
						
						const setpointSetting = Setpoint2Setting[setpointType];
						if (!setpointSetting) {
							this.error(`No matching setting found for setpoint type: ${setpointType}`);
						} else {
							this.setSettings({
								[setpointSetting]: setpointValue * 10,
							}).catch(err => this.error(`Error updating settings: ${err.message}`));
						}

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
		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: { getOnStart: true },
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => {
				this.log('thermostat_mode setParser - received value:', value);
				if (!this.CapabilityToThermostatMode.hasOwnProperty(value)) {
					this.log('thermostat_mode setParser - invalid value, no matching mode found');
					return null;
				}
				const mode = this.CapabilityToThermostatMode[value];
				this.log('thermostat_mode setParser - mapped to mode:', mode);
				if (typeof mode !== 'string') {
					this.log('thermostat_mode setParser - invalid mode type');
					return null;
				}
				
				try {
					const result = {
						Level: {
							'No of Manufacturer Data fields': 0,
							'Mode': mode,
						},
						'Manufacturer Data': Buffer.from([]),
					};
					this.log('thermostat_mode setParser - sending:', JSON.stringify(result));
					return result;
				} catch (err) {
					this.error(`Error creating thermostat mode command: ${err.message}`);
					return null;
				}
			},
			report: 'THERMOSTAT_MODE_REPORT',
			reportParser: report => {
				this.log('Thermostat mode report:', report);
				try {
					if (report && report.Level && report.Level.Mode) {
						const mode = report.Level.Mode;
						if (typeof mode === 'string' && this.ThermostatModeToCapability.hasOwnProperty(mode)) {
							const capabilityMode = this.ThermostatModeToCapability[mode];
							this.log('Capability Mode', capabilityMode);
							return capabilityMode;
						} else {
							this.log(`Unknown thermostat mode received: ${mode}`);
						}
					}
				} catch (err) {
					this.error(`Error processing thermostat mode report: ${err.message}`);
				}
				return null;
			},
		});


		this.registerReportListener('CONFIGURATION', 'CONFIGURATION_REPORT', async report => {
			try {
				const confValRaw = report['Configuration Value (Raw)'];
				const paramNum = report?.['Parameter Number'];
				
				if (paramNum === undefined || paramNum === null) {
					this.error('Missing Parameter Number in CONFIGURATION_REPORT');
					return;
				}
				
				// Find the matching setting in the manifest
				const manifestSettings = this.getManifestSettings();
				const matchingSetting = manifestSettings.find(setting => 
					setting.zwave && setting.zwave.index === paramNum
				);
				
				// Get parameter size and signed status from the manifest
				const paramSize = matchingSetting?.zwave?.size || 1;
				// Parameters are signed by default unless explicitly set to false
				const isSigned = !(matchingSetting?.zwave?.signed === false);
				
				let parsedValue;
				let valueBuffer;
				
				if (Buffer.isBuffer(confValRaw)) {
					valueBuffer = confValRaw;
				} else if (confValRaw && Array.isArray(confValRaw.data)) {
					valueBuffer = Buffer.from(confValRaw.data);
				} else {
					this.error(`Invalid Configuration Value format: ${JSON.stringify(report, null, 2)}`);
					return;
				}
				
				// Check if buffer has enough bytes
				if (valueBuffer.length < paramSize) {
					this.error(`Buffer too small for parameter size: ${valueBuffer.length} < ${paramSize}`);
					return;
				}
				
				// Read the appropriate number of bytes based on manifest settings
				try {
					if (paramSize === 1) {
						parsedValue = isSigned 
							? valueBuffer.readInt8(0) 
							: valueBuffer.readUInt8(0);
					} else if (paramSize === 2) {
						parsedValue = isSigned 
							? valueBuffer.readInt16BE(0) 
							: valueBuffer.readUInt16BE(0);
					} else if (paramSize === 4) {
						parsedValue = isSigned 
							? valueBuffer.readInt32BE(0) 
							: valueBuffer.readUInt32BE(0);
					} else {
						this.error(`Unsupported parameter size: ${paramSize}`);
						return;
					}
				} catch (err) {
					this.error(`Error reading configuration value: ${err.message}`);
					return;
				}
				
				this.log(`Updating settings - Parameter ${paramNum}: ${parsedValue} (size: ${paramSize}, signed: ${isSigned})`);
				
				if (matchingSetting) {
					let settingValue = parsedValue;
					if (matchingSetting.type === 'checkbox') {
						settingValue = Boolean(parsedValue);
					} else if (matchingSetting.type === 'dropdown') {
						settingValue = String(parsedValue);
					}
					
					this.log(`Found matching setting ${matchingSetting.id} for parameter ${paramNum}, setting value to ${settingValue}`);
					await this.setSettings({ [matchingSetting.id]: settingValue });
					this.log(`Updated setting ${matchingSetting.id} (parameter ${paramNum}) to ${settingValue}`);
				} else {
					await this.setSettings({ [`param_${paramNum}`]: parsedValue });
					this.log(`Updated parameter ${paramNum} to ${parsedValue} (no matching setting ID found)`);
				}
			} catch (error) {
				this.error(`Error processing CONFIGURATION_REPORT: ${error.message}`);
			}
		});

		this.registerCapability('thermostat_state_IdleHeatCoolFan', 'THERMOSTAT_OPERATING_STATE', {
			getOpts: {
				getOnStart: true,
			},
			get: 'THERMOSTAT_OPERATING_STATE_GET',
			report: 'THERMOSTAT_OPERATING_STATE_REPORT',
			reportParser: report => {
				this.log('THERMOSTAT_OPERATING_STATE report:', report);
				if (report && report.Level && report.Level['Operating State']) {
					let state = report.Level['Operating State'];
					
					// Map the Z-Wave state to the capability ID
					if (state === 'Vent/Economizer') {
						state = 'Vent_Economizer';
					}
					
					if (typeof state === 'string') {
						try {
							const thermostatStateObj = {
								state: state,
								state_name: typeof this.homey.__ === 'function' ? 
									this.homey.__(`state.${state}`) : 
									state,
							};
							if (this.homey.app && this.homey.app.triggerThermostatStateChangedTo) {
								this.homey.app.triggerThermostatStateChangedTo.trigger(this, null, thermostatStateObj)
									.catch(err => this.error('Error triggering flow card:', err));
							}
							return state;
						} catch (err) {
							this.error(`Error processing thermostat state: ${err.message}`);
							return state; // Still return the state even if trigger fails
						}
					}
				}
				return null;
			},
		});

		this.setAvailable().catch(err => this.error(`Error setting device available: ${err.message}`));

	}
}

module.exports = ZTRM6FCDevice;
