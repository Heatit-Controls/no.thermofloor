'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const Homey = require('homey');
const { Mode2Setpoint } = require('../../lib/map/ZTEMP3_mappings.js');
const { Setpoint2Setting } = require('../../lib/map/ZTEMP3_mappings.js');

class ZTRM6Device extends ZwaveDevice {
	constructor(...args) {
		super(...args);
		
		// Define constants as class properties
		this.CapabilityToThermostatMode = {
			'off': 'Off',
			'heat': 'Heat',
			'cool': 'Cool',
			'energy save heat': 'Energy Save Heat',
		};

		this.ThermostatModeToCapability = {
			'Off': 'off',
			'Heat': 'heat',
			'Cool': 'cool',
			'Energy Save Heat': 'energy save heat',
		};
	}
	
	async onNodeInit() {
		// enable debug logging
		//this.enableDebug();
		
		if (this.hasCapability('thermostat_state_IdleHeatCool') === false) {
			await this.addCapability('thermostat_state_IdleHeatCool');
		}
		if (this.hasCapability('thermostat_state_13570') === true) {
			await this.removeCapability('thermostat_state_13570');
		}
		
		if (this.hasCapability('powerregulator_mode') === false) {
			await this.addCapability('powerregulator_mode');
		}

		//map param 2 to sensor to show correct temp in measure.temperature
		this.PARAM2_SENSOR_MAP = {
			0: 'measure_temperature.floor',
			1: 'measure_temperature.internal',
			2: 'measure_temperature.internal',
			3: 'measure_temperature.external',
			4: 'measure_temperature.external',
			5: 'measure_temperature.internal',
		};

		// print the node's info to the console
		// this.printNode();
		
		// register capabilities for this device
		this.registerCapability('measure_temperature.internal', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
			multiChannelNodeId: 2
		});
		this.registerCapability('measure_temperature.external', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
			multiChannelNodeId: 3
		});
		this.registerCapability('measure_temperature.floor', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
			multiChannelNodeId: 4
		});
		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
			report: 'SENSOR_MULTILEVEL_REPORT',
			reportParser: report => {
				try {
					const selectedTemperatureCapability = this.getStoreValue('selectedTemperatureCapability') || 'measure_temperature.internal';

					this.log(`Getting value from ${selectedTemperatureCapability}`);
					const value = this.getCapabilityValue(selectedTemperatureCapability);
					
					return value;
				} catch (error) {
					this.error(`Error in measure_temperature reportParser: ${error.message}`);
					return null;
				}
			}
		});


		this.registerCapability('meter_power', 'METER', {
			getOpts: {
				getOnStart: true,
			},
			multiChannelNodeId: 1
		});
		this.registerCapability('measure_power', 'METER', {
			getOpts: {
				getOnStart: true,
			},
			multiChannelNodeId: 1
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
			multiChannelNodeId: 1,
		});

		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: { getOnStart: true },
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => {
				if (!this.CapabilityToThermostatMode.hasOwnProperty(value)) return null;
				const mode = this.CapabilityToThermostatMode[value];
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
					if (typeof mode === 'string' && this.ThermostatModeToCapability.hasOwnProperty(mode)) {
						const capabilityMode = this.ThermostatModeToCapability[mode];
						this.log('Capability Mode', capabilityMode);
						return capabilityMode;
					}
				}
				return null;
			},
			multiChannelNodeId: 1,
		});

		try {
			const settings = await this.getSettings();
			const sensorMode = parseInt(settings.sensor_mode, 10);
			const selectedTemperatureCapability = this.PARAM2_SENSOR_MAP[sensorMode] || 'measure_temperature.internal';
			this.log(`Initialized with sensor mode: ${sensorMode}. Selected temperature capability set to: ${selectedTemperatureCapability}`);
			await this.setStoreValue('selectedTemperatureCapability', selectedTemperatureCapability);
			// Update measure_temperature with value fgrom selected sensor
			const latestValue = await this.getCapabilityValue(selectedTemperatureCapability);
			this.setCapabilityValue('measure_temperature', latestValue).catch(err => 
				this.error(`Failed to update measure_temperature: ${err.message}`)
			);
		} catch (err) {
			this.log('Error retrieving settings:', err);
		}
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
					if (paramNum === this.getManifestSettings().find(setting => setting.id === 'sensor_mode').zwave.index) {
						this.log('sensor_mode change detected');
						// Special handling for sensor mode
						await this.setSettings({ sensor_mode: String(parsedValue) });
						const selectedTemperatureCapability = this.PARAM2_SENSOR_MAP[parsedValue] || 'measure_temperature.internal';
						this.log(`Settings updated: sensor_mode = ${parsedValue}, selectedTemperatureCapability = ${selectedTemperatureCapability}`);
						await this.setStoreValue('selectedTemperatureCapability', selectedTemperatureCapability);
						
						// Update the measure_temperature with the value from the newly selected sensor
						const latestValue = await this.getCapabilityValue(selectedTemperatureCapability);
						this.log(`Updating measure_temperature to ${latestValue} from ${selectedTemperatureCapability} after configuration change`);
						try {
							await this.setCapabilityValue('measure_temperature', latestValue);
						} catch (err) {
							this.error(`Failed to update measure_temperature: ${err.message}`);
						}
					} else if (paramNum === this.getManifestSettings().find(setting => setting.id === 'power_reg_active_time').zwave.index) {
						this.log('power_reg_active_time change detected');
						this.log('power_reg_active_time changed to', parsedValue);
						try {
							await this.setCapabilityValue('powerregulator_mode', parsedValue);
							await this.setSettings({ power_reg_active_time: parsedValue });
						} catch (error) {
							this.error(`Failed to update powerregulator settings: ${error.message}`);
						}
					} else {
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
					}
				} catch (error) {
					this.error(`Error processing CONFIGURATION_REPORT: ${error.message}`);
				}
			} catch (error) {
				this.error(`Error processing CONFIGURATION_REPORT: ${error.message}`);
			}
		});

		this.registerCapability('thermostat_state_IdleHeatCool', 'THERMOSTAT_OPERATING_STATE', {
			getOpts: {
				getOnStart: true,
			},
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
						if (this.homey.app && this.homey.app.triggerThermostatStateChangedTo) {
							this.homey.app.triggerThermostatStateChangedTo.trigger(this, null, thermostatStateObj)
								.catch(err => this.error('Error triggering flow card:', err));
						}
						return state;
					}
				}
				return null;
			},
			multiChannelNodeId: 1,
		});
		
		this.registerCapabilityListener('powerregulator_mode', async (value) => {
			try {
				this.setCapabilityValue('powerregulator_mode', value);
				this.setSettings({ power_reg_active_time: value });

			} catch (error) {
				this.error(`Failed to update powerregulator_mode: ${error.message}`);
			}

			this.configurationSet({
				index: this.getManifestSettings().find(setting => setting.id === 'power_reg_active_time').zwave.index,
				size: 0x01,
				signed: false
			}, value);
		});

		this.powerregulatorMode();
		this.setAvailable().catch(this.error);

	}

	powerregulatorMode() {
		const settings = this.getSettings();
		this.setCapabilityValue('powerregulator_mode', settings.power_reg_active_time);
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		if (super.onSettings) {
			await super.onSettings({ oldSettings, newSettings, changedKeys });
		}

		if (changedKeys.includes('sensor_mode')) {
			const sensorMode = parseInt(newSettings.sensor_mode, 10);
			const selectedTemperatureCapability = this.PARAM2_SENSOR_MAP[sensorMode] || 'measure_temperature.internal';
			this.log(`Sensor mode changed to ${sensorMode}. Selected temperature capability set to: ${selectedTemperatureCapability}`);
			
			// Store the updated capability selection
			await this.setStoreValue('selectedTemperatureCapability', selectedTemperatureCapability);
			
			// Update the measure_temperature with the value from the newly selected sensor
			const latestValue = await this.getCapabilityValue(selectedTemperatureCapability);
			this.log(`Updating measure_temperature to ${latestValue} from ${selectedTemperatureCapability} after sensor mode change`);
			try {
				await this.setCapabilityValue('measure_temperature', latestValue);
			} catch (err) {
				this.error(`Failed to update measure_temperature: ${err.message}`);
			}
		}

		return true;
	}
}

module.exports = ZTRM6Device;
