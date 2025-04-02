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
		this.enableDebug();
		
		if (this.hasCapability('thermostat_state_IdleHeatCool') === false) {
			await this.addCapability('thermostat_state_IdleHeatCool');
		}
		if (this.hasCapability('thermostat_state_13570') === true) {
			await this.removeCapability('thermostat_state_13570');
		}
		
		// Remove powerregulator_mode capability if it exists
		if (this.hasCapability('powerregulator_mode') === true) {
			await this.removeCapability('powerregulator_mode');
		}

		// Store the original temperature options for restoring later
		this._originalTempOptions = {
			min: 5,
			max: 40,
			step: 0.5
		};
		
		// Store the powerregulator temperature options
		this._powerRegulatorTempOptions = {
			min: 1,
			max: 10,
			step: 1
		};

		// Store the power regulator value in device store rather than as a capability
		const storedPowerRegValue = this.getStoreValue('power_reg_value');
		if (storedPowerRegValue === null || storedPowerRegValue === undefined) {
			await this.setStoreValue('power_reg_value', 5); // Default to middle value
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
				getOnStart: false,
			},
			getParser: () => {
				try {
					// Check if the device is in powerregulator mode
					const currentMode = this.getCapabilityValue('thermostat_mode');
					if (currentMode === 'Powerregulator') {
						// In powerregulator mode, we don't need to get the thermostat setpoint
						// Return null here to prevent sending the command
						return null;
					}
					
					// For regular modes, retrieve the setpointType
					const setpointType = Mode2Setpoint[currentMode] || 'Heating 1'; // fallback
					return {
						Level: {
							'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
						},
					};
				} catch (error) {
					this.error(`Error in target_temperature getParser: ${error.message}`);
					// Return a safe default to prevent errors
					return {
						Level: {
							'Setpoint Type': 'Heating 1',
						},
					};
				}
			},
			set: 'THERMOSTAT_SETPOINT_SET',
			setParserV3: setpointValue => {
				const currentMode = this.getCapabilityValue('thermostat_mode');
				
				// Handle powerregulator mode
				if (currentMode === 'Powerregulator') {
					// When in powerregulator mode, use target_temperature directly as the powerregulator level
					// We're limiting the value to 1-10 range
					let powerRegValue = Math.round(setpointValue);
					
					// Ensure the value is within the 1-10 range
					powerRegValue = Math.max(1, Math.min(10, powerRegValue));
					
					// Store the power regulator value
					this.setStoreValue('power_reg_value', powerRegValue).catch(this.error);
					
					// Update settings directly
					this.setSettings({ power_reg_active_time: powerRegValue }).catch(err => {
						this.error(`Failed to update power_reg_active_time setting: ${err.message}`);
					});
					
					// Send the configuration to the device
					this.configurationSet({
						index: this.getParameterIndex('power_reg_active_time'),
						size: 0x01,
						signed: false
					}, powerRegValue);
					
					// Return null to prevent sending THERMOSTAT_SETPOINT_SET
					return null;
				}
				
				// Regular thermostat mode handling (existing code)
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
				try {
					// Get current thermostat mode
					const currentMode = this.getCapabilityValue('thermostat_mode');
					
					// If in powerregulator mode, don't process regular thermostat setpoint reports
					if (currentMode === 'Powerregulator') {
						return null;
					}
					
					// Regular setpoint report handling (existing code)
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
							this.error(`Error reading setpoint value: ${err.message}`);
							return null;
						}
						if (typeof readValue !== 'undefined') {
							const setpointValue = readValue / 10 ** report.Level2.Precision;
							const setpointType = report.Level['Setpoint Type'];
							this.log('Received setpoint report:', setpointType, setpointValue);

							if (setpointType !== 'not supported') {
								this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(err => {
									this.error(`Failed to store setpoint value: ${err.message}`);
								});
							}
							const setpointSetting = Setpoint2Setting[setpointType];
							this.setSettings({
								[setpointSetting]: setpointValue * 10,
							}).catch(err => {
								this.error(`Failed to update setpoint setting: ${err.message}`);
							});

							// Only update the UI if the current mode matches the type
							if (setpointType === Mode2Setpoint[currentMode]) {
								this.log('Updated thermostat setpoint on UI to', setpointValue);
								return setpointValue;
							}
							return null;
						}
					}
					return null;
				} catch (error) {
					this.error(`Error in target_temperature reportParser: ${error.message}`);
					return null;
				}
			},
			multiChannelNodeId: 1,
		});

		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: { getOnStart: true },
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => {
				// Handle special case for Powerregulator
				if (value === 'Powerregulator') {
					// Save the current thermostat mode before switching to power regulator
					const currentMode = this.getCapabilityValue('thermostat_mode');
					if (currentMode && currentMode !== 'Powerregulator') {
						this.log(`Saving previous thermostat mode: ${currentMode}`);
						this.setStoreValue('thermostat_mode', currentMode).catch(this.error);
						
						// Save the current sensor mode before switching to power regulator
						const settings = this.getSettings();
						if (settings && settings.sensor_mode && settings.sensor_mode !== '5') {
							this.log(`Saving previous sensor mode: ${settings.sensor_mode}`);
							this.setStoreValue('previous_sensor_mode', settings.sensor_mode).catch(this.error);
						}
					}
					
					// Update the temperature scale to 1-10 for powerregulator mode
					this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions)
						.then(() => {
							// Update the target_temperature to match the current powerregulator value
							const powerRegValue = this.getPowerRegulatorValue();
							this.setCapabilityValue('target_temperature', powerRegValue).catch(this.error);
						})
						.catch(this.error);
					
					// Find sensor_mode parameter index
					const sensorModeIndex = this.getParameterIndex('sensor_mode');
					// Find power regulator mode value (PWER)
					const pwrValue = 5; // Default as fallback
					
					// Change the sensor_mode parameter to power regulator mode
					try {
						this.configurationSet({
							index: sensorModeIndex || 2, // Fallback to 2 if not found
							size: 1,  // Size in bytes
							signed: false
						}, pwrValue);
						
						// Update the sensor_mode setting in the device settings
						this.setSettings({
							sensor_mode: String(pwrValue) // Update the setting to match the configuration
						}).catch(err => {
							this.error(`Failed to update sensor_mode setting: ${err.message}`);
						});
					} catch (error) {
						this.error(`Failed to set power regulator mode: ${error.message}`);
					}
					
					// Don't send thermostat mode command
					return null;
				} else {
					// If switching from Powerregulator to another mode, restore the previous sensor mode
					const currentMode = this.getCapabilityValue('thermostat_mode');
					if (currentMode === 'Powerregulator') {
						// Update the temperature scale back to normal range
						this.setCapabilityOptions('target_temperature', this._originalTempOptions)
							.catch(this.error);
						
						// Get the previous sensor mode or use a default
						// Wrap in try/catch to handle any potential Promise-related errors
						try {
							// Ensure we're working with a valid Promise
							Promise.resolve(this.getStoreValue('previous_sensor_mode'))
								.then(previousSensorMode => {
									if (previousSensorMode && previousSensorMode !== '5') {
										const sensorModeIndex = this.getParameterIndex('sensor_mode');
										const sensorModeValue = parseInt(previousSensorMode, 10);
										
										this.log(`Restoring previous sensor mode: ${previousSensorMode}`);
										
										// Set the configuration parameter
										this.configurationSet({
											index: sensorModeIndex || 2,
											size: 1,
											signed: false
										}, sensorModeValue);
										
										// Update the settings
										this.setSettings({
											sensor_mode: previousSensorMode
										}).catch(err => {
											this.error(`Failed to update sensor_mode setting: ${err.message}`);
										});
									} else {
										this.log('No valid previous sensor mode found, defaulting to internal sensor (1)');
										// Default to internal sensor if no previous mode found
										const sensorModeIndex = this.getParameterIndex('sensor_mode');
										this.configurationSet({
											index: sensorModeIndex || 2,
											size: 1,
											signed: false
										}, 1); // 1 = internal sensor
										
										this.setSettings({
											sensor_mode: '1'
										}).catch(err => {
											this.error(`Failed to update sensor_mode setting: ${err.message}`);
										});
									}
								})
								.catch(err => {
									this.error(`Failed to get previous sensor mode: ${err.message}`);
									// Default to internal sensor if error
									const sensorModeIndex = this.getParameterIndex('sensor_mode');
									this.configurationSet({
										index: sensorModeIndex || 2,
										size: 1,
										signed: false
									}, 1); // 1 = internal sensor
									
									this.setSettings({
										sensor_mode: '1'
									}).catch(err => {
										this.error(`Failed to update sensor_mode setting: ${err.message}`);
									});
								});
						} catch (error) {
							this.error(`Error handling sensor mode restoration: ${error.message}`);
							// Fallback to internal sensor
							try {
								const sensorModeIndex = this.getParameterIndex('sensor_mode');
								this.configurationSet({
									index: sensorModeIndex || 2,
									size: 1,
									signed: false
								}, 1); // 1 = internal sensor
								
								this.setSettings({
									sensor_mode: '1'
								}).catch(err => {
									this.error(`Failed to update sensor_mode setting: ${err.message}`);
								});
							} catch (innerError) {
								this.error(`Failed to set fallback sensor mode: ${innerError.message}`);
							}
						}
					}
				}
				
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
					try {
						// Use our handler but ensure we return a string
						const result = this.handleThermostatModeReport(mode);
						if (result !== null && typeof result !== 'string') {
							this.error(`Invalid result type from handleThermostatModeReport: ${typeof result}`);
							return null;
						}
						return result;
					} catch (error) {
						this.error(`Error in thermostat_mode reportParser: ${error.message}`);
						return null;
					}
				}
				return null;
			},
			multiChannelNodeId: 1,
		});

		try {
			const settings = await this.getSettings();
			const sensorMode = parseInt(settings.sensor_mode, 10);
			
			// Update the selected temperature capability
			await this.updateSelectedTemperatureCapability(sensorMode);
			
			// Check if device is in power regulator mode (sensor_mode = 5) and update the UI
			if (sensorMode === 5) {
				this.log('Device initialized in power regulator mode, updating thermostat_mode');
				try {
					// Update the temperature scale to 1-10 for powerregulator mode
					await this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions);
					
					// First set thermostat mode
					await this.setCapabilityValue('thermostat_mode', 'Powerregulator');
					
					// Then manually set the target_temperature without triggering a get
					const powerRegValue = settings.power_reg_active_time || this.getStoreValue('power_reg_value') || 5;
					await this.setCapabilityValue('target_temperature', powerRegValue);
				} catch (err) {
					this.error(`Failed to set thermostat_mode to Powerregulator: ${err.message}`);
				}
			} else {
				// Ensure we have a valid thermostat mode and temperature scale
				await this.setCapabilityOptions('target_temperature', this._originalTempOptions);
				
				const currentMode = this.getCapabilityValue('thermostat_mode');
				if (currentMode === 'Powerregulator') {
					const storedMode = await this.getStoreValue('thermostat_mode');
					if (storedMode && typeof storedMode === 'string' && storedMode !== 'Powerregulator') {
						try {
							await this.setCapabilityValue('thermostat_mode', storedMode);
							
							// Get stored temperature value for this mode
							const setpointType = Mode2Setpoint[storedMode];
							if (setpointType && setpointType !== 'not supported') {
								const storedValue = await this.getStoreValue(`thermostatsetpointValue.${setpointType}`);
								if (storedValue !== null && storedValue !== undefined) {
									await this.setCapabilityValue('target_temperature', storedValue);
								}
							}
						} catch (err) {
							this.error(`Failed to restore stored thermostat mode: ${err.message}`);
						}
					} else {
						try {
							await this.setCapabilityValue('thermostat_mode', 'heat');
							
							// Set default temperature value
							const defaultTemp = 21;
							await this.setCapabilityValue('target_temperature', defaultTemp);
						} catch (err) {
							this.error(`Failed to set default thermostat mode: ${err.message}`);
						}
					}
				}
			}
		} catch (err) {
			this.log('Error retrieving settings:', err);
		}
		this.registerReportListener('CONFIGURATION', 'CONFIGURATION_REPORT', async report => {
			await this.handleConfigurationReport(report);
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
		
		// Initialize powerregulator value if in powerregulator mode
		this.initPowerRegulatorMode();
		this.setAvailable().catch(this.error);

	}

	async initPowerRegulatorMode() {
		try {
			// Initialize the device with the stored or settings power regulator value if needed
			const currentMode = this.getCapabilityValue('thermostat_mode');
			if (currentMode === 'Powerregulator') {
				// Make sure we have the correct temperature scale
				await this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions)
					.catch(err => this.error(`Failed to set powerregulator temp options: ${err.message}`));
				
				// Get the current power regulator value from store or settings
				const powerRegValue = this.getPowerRegulatorValue();
				
				// Set the target_temperature to match the power regulator value
				await this.setCapabilityValue('target_temperature', powerRegValue)
					.catch(err => this.error(`Failed to set target_temperature: ${err.message}`));
				
				this.log(`Power regulator mode initialized with value: ${powerRegValue}`);
			}
		} catch (error) {
			this.error(`Error in initPowerRegulatorMode: ${error.message}`);
		}
	}

	async handleThermostatModeForSensorMode(sensorMode) {
		this.log(`Handling thermostat mode for sensor mode: ${sensorMode}`);
		const currentThermostatMode = this.getCapabilityValue('thermostat_mode');
		
		if (sensorMode === 5) {
			// Set to power regulator mode
			if (currentThermostatMode !== 'Powerregulator') {
				try {
					// First, update the target_temperature UI options to show 1-10 scale
					await this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions);
					
					this.log('Setting thermostat_mode to Powerregulator');
					await this.setCapabilityValue('thermostat_mode', 'Powerregulator');
					
					// Set target_temperature to the current power regulator value directly
					const powerRegValue = this.getPowerRegulatorValue();
					await this.setCapabilityValue('target_temperature', powerRegValue);
				} catch (error) {
					this.error(`Failed to update thermostat_mode to Powerregulator: ${error.message}`);
				}
			} else {
				this.log('Device already in Powerregulator mode');
			}
		} else {
			// Only restore if currently in Powerregulator mode
			if (currentThermostatMode === 'Powerregulator') {
				try {
					// First, update the target_temperature UI options back to regular temperature scale
					await this.setCapabilityOptions('target_temperature', this._originalTempOptions);
					
					// Restore previous thermostat mode when not in power regulator mode
					const previousMode = await this.getStoreValue('thermostat_mode');
					this.log('Sensor mode is not 5, restoring previous thermostat mode', previousMode);
					
					if (previousMode && typeof previousMode === 'string' && previousMode !== 'Powerregulator') {
						try {
							this.log(`Restoring previous thermostat mode: ${previousMode}`);
							await this.setCapabilityValue('thermostat_mode', previousMode);
							
							// Restore previous temperature setpoint
							const setpointType = Mode2Setpoint[previousMode];
							if (setpointType && setpointType !== 'not supported') {
								const previousSetpoint = await this.getStoreValue(`thermostatsetpointValue.${setpointType}`);
								if (previousSetpoint !== null && previousSetpoint !== undefined) {
									await this.setCapabilityValue('target_temperature', previousSetpoint);
								}
							}
						} catch (error) {
							this.error(`Failed to restore previous thermostat mode: ${error.message}`);
						}
					} else {
						// Default to heat if no previous mode is stored or it's not a string
						try {
							this.log('No valid previous mode stored, defaulting to heat');
							await this.setCapabilityValue('thermostat_mode', 'heat');
							
							// Set a default temperature setpoint
							const defaultSetpoint = 21; // Common default temperature
							await this.setCapabilityValue('target_temperature', defaultSetpoint);
						} catch (error) {
							this.error(`Failed to set default thermostat mode: ${error.message}`);
						}
					}
				} catch (error) {
					this.error(`Failed to restore from powerregulator mode: ${error.message}`);
				}
			} else {
				this.log(`Already in non-powerregulator mode: ${currentThermostatMode}, no mode change needed`);
			}
		}
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		if (super.onSettings) {
			await super.onSettings({ oldSettings, newSettings, changedKeys });
		}

		if (changedKeys.includes('sensor_mode')) {
			const sensorMode = parseInt(newSettings.sensor_mode, 10);
			
			// Update the selected temperature capability
			await this.updateSelectedTemperatureCapability(sensorMode);
			
			// Handle thermostat mode based on sensor mode
			await this.handleThermostatModeForSensorMode(sensorMode);
		}

		return true;
	}

	handleThermostatModeReport(mode) {
		if (typeof mode !== 'string' || !this.ThermostatModeToCapability.hasOwnProperty(mode)) {
			this.log(`Invalid thermostat mode received: ${mode} (${typeof mode})`);
			return null;
		}
		
		const capabilityMode = this.ThermostatModeToCapability[mode];
		if (typeof capabilityMode !== 'string') {
			this.log(`Invalid capability mode mapped: ${capabilityMode} (${typeof capabilityMode})`);
			return null;
		}
		
		// Check if we're in power regulator mode (sensor_mode = 5)
		const settings = this.getSettings();
		if (settings && settings.sensor_mode === '5') {
			// If in power regulator mode, keep the UI showing 'Powerregulator'
			this.log('Device is in power regulator mode, ignoring thermostat mode report');
			
			// Still store the actual device mode for future use when exiting power regulator
			if (capabilityMode !== 'Powerregulator') {
				// Use .catch to avoid Promise return
				this.setStoreValue('thermostat_mode', capabilityMode).catch(err => 
					this.error(`Failed to store thermostat_mode: ${err.message}`)
				);
			}
			
			// Maintain the UI showing power regulator - do this in a separate setTimeout to avoid Promise returns
			setTimeout(() => {
				this.setCapabilityValue('thermostat_mode', 'Powerregulator').catch(err => 
					this.error(`Failed to set thermostat_mode to Powerregulator: ${err.message}`)
				);
				
				// Also ensure target_temperature shows the power regulator value
				const powerRegValue = this.getPowerRegulatorValue();
				this.setCapabilityValue('target_temperature', powerRegValue).catch(err => 
					this.error(`Failed to update target_temperature for powerregulator: ${err.message}`)
				);
			}, 500);
			
			return 'Powerregulator';
		}
		
		// Normal mode handling
		// Use .catch to avoid Promise return
		this.setStoreValue('thermostat_mode', capabilityMode).catch(err => 
			this.error(`Failed to store thermostat_mode: ${err.message}`)
		);
		this.log('Capability Mode', capabilityMode);
		return capabilityMode;
	}

	async updateSelectedTemperatureCapability(sensorMode) {
		// Get the appropriate temperature capability based on sensor mode
		const selectedTemperatureCapability = this.PARAM2_SENSOR_MAP[sensorMode] || 'measure_temperature.internal';
		this.log(`Setting selected temperature capability to: ${selectedTemperatureCapability} for sensor mode: ${sensorMode}`);
		
		// Store the updated capability selection
		await this.setStoreValue('selectedTemperatureCapability', selectedTemperatureCapability);
		
		// Update the measure_temperature with the value from the newly selected sensor
		const latestValue = await this.getCapabilityValue(selectedTemperatureCapability);
		this.log(`Updating measure_temperature to ${latestValue} from ${selectedTemperatureCapability}`);
		try {
			await this.setCapabilityValue('measure_temperature', latestValue);
		} catch (err) {
			this.error(`Failed to update measure_temperature: ${err.message}`);
		}
		
		return selectedTemperatureCapability;
	}

	async setPowerRegulatorValue(value) {
		this.log(`Setting power regulator value to: ${value}`);
		try {
			// Store the value
			await this.setStoreValue('power_reg_value', value);
			
			// Update the settings
			await this.setSettings({ power_reg_active_time: value });
			
			// If in powerregulator mode, update target_temperature to directly show the power regulator value
			if (this.getCapabilityValue('thermostat_mode') === 'Powerregulator') {
				await this.setCapabilityValue('target_temperature', value);
			}
			
			// Send the configuration to the device
			this.configurationSet({
				index: this.getParameterIndex('power_reg_active_time'),
				size: 0x01,
				signed: false
			}, value);
		} catch (error) {
			this.error(`Failed to update powerregulator settings: ${error.message}`);
		}
	}

	getPowerRegulatorValue() {
		// First try to get from settings
		const settings = this.getSettings();
		if (settings && settings.power_reg_active_time) {
			return settings.power_reg_active_time;
		}
		
		// Fall back to stored value
		return this.getStoreValue('power_reg_value') || 5;
	}

	getParameterIndex(settingId) {
		const setting = this.getManifestSettings().find(setting => setting.id === settingId);
		if (setting && setting.zwave && setting.zwave.index !== undefined) {
			return setting.zwave.index;
		}
		return null;
	}

	parseConfigurationValue(confValRaw, paramSize, isSigned) {
		let valueBuffer;
		
		if (Buffer.isBuffer(confValRaw)) {
			valueBuffer = confValRaw;
		} else if (confValRaw && Array.isArray(confValRaw.data)) {
			valueBuffer = Buffer.from(confValRaw.data);
		} else {
			this.log(`Invalid Configuration Value format: ${JSON.stringify(confValRaw, null, 2)}`);
			return null;
		}
		
		// Read the appropriate number of bytes based on manifest settings
		let parsedValue;
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
		
		return parsedValue;
	}
	
	getParameterInfo(paramNum) {
		// Find the matching setting in the manifest
		const manifestSettings = this.getManifestSettings();
		const matchingSetting = manifestSettings.find(setting => 
			setting.zwave && setting.zwave.index === paramNum
		);
		
		// Get parameter size and signed status from the manifest
		const paramSize = matchingSetting?.zwave?.size || 1;
		// Parameters are signed by default unless explicitly set to false
		const isSigned = !(matchingSetting?.zwave?.signed === false);
		
		return { matchingSetting, paramSize, isSigned };
	}
	
	async processGenericParameter(paramNum, parsedValue, matchingSetting) {
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

	async handleConfigurationReport(report) {
		try {
			const confValRaw = report['Configuration Value (Raw)'];
			const paramNum = report?.['Parameter Number'];
			
			// Get parameter info
			const { matchingSetting, paramSize, isSigned } = this.getParameterInfo(paramNum);
			
			let parsedValue;
			
			if (Buffer.isBuffer(confValRaw)) {
				parsedValue = this.parseConfigurationValue(confValRaw, paramSize, isSigned);
			} else if (confValRaw && Array.isArray(confValRaw.data)) {
				parsedValue = this.parseConfigurationValue(confValRaw, paramSize, isSigned);
			} else {
				this.log(`Invalid Configuration Value format: ${JSON.stringify(report, null, 2)}`);
				return;
			}
			
			this.log(`Updating settings - Parameter ${paramNum}: ${parsedValue} (size: ${paramSize}, signed: ${isSigned})`);
			
			try {
				if (paramNum === this.getParameterIndex('sensor_mode')) {
					// Special handling for sensor mode
					await this.setSettings({ sensor_mode: String(parsedValue) });
					
					// Update the selected temperature capability
					await this.updateSelectedTemperatureCapability(parsedValue);
					
					// Handle thermostat mode based on sensor mode
					await this.handleThermostatModeForSensorMode(parsedValue);
				} else if (paramNum === this.getParameterIndex('power_reg_active_time')) {
					this.log('power_reg_active_time changed to', parsedValue);
					await this.setStoreValue('power_reg_value', parsedValue);
					await this.setSettings({ power_reg_active_time: parsedValue });
					
					// If in powerregulator mode, update target_temperature
					if (this.getCapabilityValue('thermostat_mode') === 'Powerregulator') {
						await this.setCapabilityValue('target_temperature', parsedValue);
					}
				} else {
					await this.processGenericParameter(paramNum, parsedValue, matchingSetting);
				}
			} catch (error) {
				this.error(`Error processing CONFIGURATION_REPORT: ${error.message}`);
			}
		} catch (error) {
			this.error(`Error processing CONFIGURATION_REPORT: ${error.message}`);
		}
	}
}

module.exports = ZTRM6Device;
