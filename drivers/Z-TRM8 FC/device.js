'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const { buildMappings } = require('../../lib/map/thermostat_mappings.js');
const { Mode2Setpoint, Setpoint2Setting } = buildMappings(['off', 'heat', 'cool', 'energy save heat', 'energy save cool', 'auto changeover', 'fan only']);

class ZTRM8FCDevice extends ZwaveDevice {
	constructor(...args) {
		super(...args);
		
		// Define constants as class properties
		this.CapabilityToThermostatMode = {
			'off': 'Off',
			'heat': 'Heat',
			'cool': 'Cool',
			'energy save heat': 'Energy Save Heat',
			'energy save cool': 'Energy Save Cool',
			'auto changeover': 'Auto Changeover',
			'fan only': 'Fan Only',
		};

		this.ThermostatModeToCapability = {
			'Off': 'off',
			'Heat': 'heat',
			'Cool': 'cool',
			'Energy Save Heat': 'energy save heat',
			'Energy Save Cool': 'energy save cool',
			'Auto Changeover': 'auto changeover',
			'Fan Only': 'fan only',
		};
		
	}
	
	async onNodeInit() {
		// enable debug logging
		this.enableDebug();
		

		// print the node's info to the console
		this.printNode();
		
		// register capabilities for this device

		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
		});

		this.registerCapability('measure_humidity', 'SENSOR_MULTILEVEL', {
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
		this.registerCapabilityListener('button.reset_meter', async () => {
			const commandClassMeter = this.getCommandClass('METER');
			if (commandClassMeter && commandClassMeter.hasOwnProperty('METER_RESET')) {
				const result = await commandClassMeter.METER_RESET({});
				if (result !== 'TRANSMIT_COMPLETE_OK') throw result;
			} else {
				throw new Error('Reset meter not supported');
			}
		});

		this.registerCapability('fan_mode', 'THERMOSTAT_FAN_MODE', {
			getOpts: {
				getOnStart: true,
			},
			get: 'THERMOSTAT_FAN_MODE_GET',
			set: 'THERMOSTAT_FAN_MODE_SET',
			setParser: fanMode => {
				this.log('Setting fan mode to:', fanMode);
				if (!fanMode) return null;
				return {
					Properties1: {
						Off: false,
						'Fan Mode': fanMode,
					},
					'Manufacturer Data': Buffer.from([0]),
				};
			},
			report: 'THERMOSTAT_FAN_MODE_REPORT',
			reportParser: report => {
				this.log('THERMOSTAT_FAN_MODE report:', report);
				if (!report || !report.Properties1) return null;
				const fanMode = report.Properties1['Fan Mode'];
				this.log('Received fan mode report:', fanMode);
				return fanMode || null;
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
				if (!report || !report.Level) return null;
				const state = report.Level['Fan Operating State'];
				return typeof state === 'string' ? state : null;
			},
		});
		
		
		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: {
				getOnStart: true,
			},
			getParser: () => {
				const currentMode = this.getCapabilityValue('thermostat_mode') || 'Heat';
				const setpointType = Mode2Setpoint[currentMode] || 'Heating 1';
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
					if (!setpointSetting) {
						this.error(`No matching setting found for setpoint type: ${setpointType}`);
						return null;
					}
					
					this.setSettings({
						[setpointSetting]: setpointValue * 10,
					}).catch(this.error);

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
					(report.Level2.Scale === 0 || report.Level2.Scale === 1) &&
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
						let setpointValue = readValue / 10 ** report.Level2.Precision;
						if (report.Level2.Scale === 1) setpointValue = (setpointValue - 32) / 1.8;
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
					this.log(`Invalid Configuration Value format: ${JSON.stringify(report, null, 2)}`);
					return;
				}
				
				// Read the appropriate number of bytes based on manifest settings
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
				}
				
				this.log(`Updating settings - Parameter ${paramNum}: ${parsedValue} (size: ${paramSize}, signed: ${isSigned})`);
				
				try {
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
					this.error(`Error processing CONFIGURATION_REPORT settings: ${error.message}`);
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
				const state = report && report.Level && report.Level['Operating State'];
				return typeof state === 'string' ? state : null;
			},
		});

		this.registerReportListener('CENTRAL_SCENE', 'CENTRAL_SCENE_NOTIFICATION', report => {
			if (report && report['Scene Number'] && report.Properties1) {
				const data = {
					button: report['Scene Number'].toString(),
				};
				this.driver.sceneFlowTrigger.trigger(this, null, data)
					.catch(err => this.error('Error triggering scene flow card:', err));
			}
		});

		this.setAvailable().catch(err => this.error(`Error setting device available: ${err.message}`));

	}

	sceneRunListener(args, state) {
		return (
			state &&
			args.hasOwnProperty('button') &&
			state.hasOwnProperty('button') &&
			state.button === args.button
		);
	}
}

module.exports = ZTRM8FCDevice;
