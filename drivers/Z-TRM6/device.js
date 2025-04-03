'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const Homey = require('homey');
const { Mode2Setpoint, Setpoint2Setting } = require('../../lib/map/ZTEMP3_mappings.js');

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

		// Temperature options
		this._originalTempOptions = { min: 5, max: 40, step: 0.5 };
		this._powerRegulatorTempOptions = { min: 10, max: 100, step: 10 };

		// Map sensor modes to temperature capability
		this.PARAM2_SENSOR_MAP = {
			0: 'measure_temperature.floor',
			1: 'measure_temperature.internal',
			2: 'measure_temperature.internal',
			3: 'measure_temperature.external',
			4: 'measure_temperature.external',
			5: 'measure_temperature.internal',
		};
	}
	
	async onNodeInit() {
		//this.enableDebug();
		
		// Ensure device has correct capabilities
		if (!this.hasCapability('thermostat_state_IdleHeatCool')) {
			await this.addCapability('thermostat_state_IdleHeatCool');
		}
		if (this.hasCapability('thermostat_state_13570')) {
			await this.removeCapability('thermostat_state_13570');
		}
		if (this.hasCapability('powerregulator_mode')) {
			await this.removeCapability('powerregulator_mode');
		}
		
		// Initialize power regulator value if not set
		if (this.getStoreValue('power_reg_value') === null) {
			await this.setStoreValue('power_reg_value', 5);
		}

		// Register all capabilities
		this.registerTemperatureCapabilities();
		this.registerPowerCapabilities();
		this.registerTargetTemperatureCapability();
		this.registerThermostatModeCapability();
		this.registerThermostatStateCapability();
		
		// Register configuration report listener
		this.registerReportListener('CONFIGURATION', 'CONFIGURATION_REPORT', 
			report => this.handleConfigurationReport(report));
		
		// Apply initial setup based on current settings
		await this.initializeDeviceState();
		
		// Initialize powerregulator value if in that mode
		await this.initPowerRegulatorMode();
		
		this.setAvailable().catch(this.error);
	}

	registerTemperatureCapabilities() {
		const getOpts = { getOnStart: true };
		
		// Register individual sensor readings
		['internal', 'external', 'floor'].forEach((sensor, idx) => {
			this.registerCapability(`measure_temperature.${sensor}`, 'SENSOR_MULTILEVEL', {
				getOpts,
				multiChannelNodeId: idx + 2 // Internal = 2, External = 3, Floor = 4
			});
		});
		
		// Register the main temperature reading that combines sensors based on selected sensor
		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts,
			report: 'SENSOR_MULTILEVEL_REPORT',
			reportParser: report => {
				try {
					const selectedSensor = this.getStoreValue('selectedTemperatureCapability') || 'measure_temperature.internal';
					return this.getCapabilityValue(selectedSensor);
				} catch (error) {
					this.error(`Error in measure_temperature reportParser: ${error.message}`);
					return null;
				}
			}
		});
	}

	registerPowerCapabilities() {
		const getOpts = { getOnStart: true };
		
		['meter_power', 'measure_power'].forEach(capability => {
			this.registerCapability(capability, 'METER', {
				getOpts,
				multiChannelNodeId: 1
			});
		});
	}

	registerTargetTemperatureCapability() {
		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: { getOnStart: true, getOnOnline: true },
			get: async () => {
				try {
					const currentMode = this.getCapabilityValue('thermostat_mode');
					const setpointType = Mode2Setpoint[currentMode] || 'Heating 1';
					return {
						Level: {
							'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
						},
					};
				} catch (error) {
					this.error(`Error in target_temperature getParser: ${error.message}`);
					return { Level: { 'Setpoint Type': 'Heating 1' } };
				}
			},
			set: 'THERMOSTAT_SETPOINT_SET',
			setParserV3: setpointValue => {
				const currentMode = this.getCapabilityValue('thermostat_mode');
				
				// Handle powerregulator mode separately
				if (currentMode === 'Powerregulator') {
					const powerRegValue = Math.max(10, Math.min(100, Math.round(setpointValue / 10) * 10));
					this.setStoreValue('power_reg_value', powerRegValue / 10).catch(this.error);
					
					this.configurationSet({
						index: this.getParameterIndex('power_reg_active_time'),
						size: 0x01,
						signed: false
					}, powerRegValue / 10);
					
					this.setSettings({ power_reg_active_time: powerRegValue / 10 })
						.catch(err => this.error(`Failed to update power_reg_active_time: ${err.message}`));
					
					return null;
				}
				
				// Regular thermostat mode handling
				const setpointType = Mode2Setpoint[currentMode];
				
				if (setpointType !== 'not supported' && setpointType) {
					// Store setpoint value and update settings
					this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);
					
					const setpointSetting = Setpoint2Setting[setpointType];
					this.setSettings({ [setpointSetting]: setpointValue * 10 }).catch(this.error);
					
					// Prepare buffer for Z-Wave command
					const bufferValue = Buffer.alloc(2);
					const scaled = (Math.round(setpointValue * 2) / 2 * 10).toFixed(0);
					bufferValue.writeUInt16BE(scaled);
					
					return {
						Level: { 'Setpoint Type': setpointType },
						Level2: { Size: 2, Scale: 0, Precision: 1 },
						Value: bufferValue,
					};
				}
				return null;
			},
			report: 'THERMOSTAT_SETPOINT_REPORT',
			reportParserV3: report => {
				try {
					// Don't process reports when in powerregulator mode
					if (this.getCapabilityValue('thermostat_mode') === 'Powerregulator') return null;
					
					if (report?.Level2?.Scale === 0 && typeof report.Level2.Size !== 'undefined') {
						const readValue = report.Value.readUIntBE(0, report.Level2.Size);
						const setpointValue = readValue / 10 ** report.Level2.Precision;
						const setpointType = report.Level['Setpoint Type'];
						
						if (setpointType !== 'not supported') {
							this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue)
								.catch(err => this.error(`Failed to store setpoint value: ${err.message}`));
								
							const setpointSetting = Setpoint2Setting[setpointType];
							this.setSettings({ [setpointSetting]: setpointValue * 10 })
								.catch(err => this.error(`Failed to update setpoint setting: ${err.message}`));
						}
						
						// Only update UI if the report type matches current mode
						const currentMode = this.getCapabilityValue('thermostat_mode');
						if (setpointType === Mode2Setpoint[currentMode]) {
							return setpointValue;
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
	}

	registerThermostatModeCapability() {
		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: { getOnStart: true },
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => {
				// Handle special case for Powerregulator
				if (value === 'Powerregulator') {
					this.handleEnterPowerRegulatorMode();
					return null;
				} else if (this.getCapabilityValue('thermostat_mode') === 'Powerregulator') {
					this.handleExitPowerRegulatorMode(value);
				}
				
				if (!this.CapabilityToThermostatMode[value]) return null;
				
				return {
					Level: {
						'No of Manufacturer Data fields': 0,
						'Mode': this.CapabilityToThermostatMode[value],
					},
					'Manufacturer Data': Buffer.from([]),
				};
			},
			report: 'THERMOSTAT_MODE_REPORT',
			reportParser: report => {
				if (report?.Level?.Mode) {
					try {
						return this.handleThermostatModeReport(report.Level.Mode);
					} catch (error) {
						this.error(`Error in thermostat_mode reportParser: ${error.message}`);
						return null;
					}
				}
				return null;
			},
			multiChannelNodeId: 1,
		});
	}

	registerThermostatStateCapability() {
		this.registerCapability('thermostat_state_IdleHeatCool', 'THERMOSTAT_OPERATING_STATE', {
			getOpts: { getOnStart: true },
			get: 'THERMOSTAT_OPERATING_STATE_GET',
			report: 'THERMOSTAT_OPERATING_STATE_REPORT',
			reportParser: report => {
				if (report?.Level?.['Operating State']) {
					const state = report.Level['Operating State'];
					if (typeof state === 'string') {
						const thermostatStateObj = {
							state,
							state_name: this.homey.__(`state.${state}`),
						};
						
						if (this.homey.app?.triggerThermostatStateChangedTo) {
							this.homey.app.triggerThermostatStateChangedTo
								.trigger(this, null, thermostatStateObj)
								.catch(err => this.error('Error triggering flow card:', err));
						}
						return state;
					}
				}
				return null;
			},
			multiChannelNodeId: 1,
		});
	}

	async handleEnterPowerRegulatorMode() {
		// Save current mode for later restoration
		const currentMode = this.getCapabilityValue('thermostat_mode');
		if (currentMode && currentMode !== 'Powerregulator') {
			await this.setStoreValue('thermostat_mode', currentMode);
			
			// Save current sensor mode
			const settings = this.getSettings();
			if (settings?.sensor_mode && settings.sensor_mode !== '5') {
				await this.setStoreValue('previous_sensor_mode', settings.sensor_mode);
			}
		}
		
		// Update the temperature scale to 10-100 for powerregulator
		await this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions);
		
		// Update target temperature to match current power regulator value
		const powerRegValue = this.getPowerRegulatorValue();
		await this.setCapabilityValue('target_temperature', powerRegValue * 10);
		
		// Change sensor mode to power regulator mode (5)
		const sensorModeIndex = this.getParameterIndex('sensor_mode') || 2;
		await this.configurationSet({ index: sensorModeIndex, size: 1, signed: false }, 5);
		
		// Update settings
		await this.setSettings({ sensor_mode: '5' })
			.catch(err => this.error(`Failed to update sensor_mode setting: ${err.message}`));
	}

	async handleExitPowerRegulatorMode(newMode) {
		// Restore temperature scale
		await this.setCapabilityOptions('target_temperature', this._originalTempOptions);
		
		// Restore previous sensor mode
		const previousSensorMode = await this.getStoreValue('previous_sensor_mode') || '1';
		const sensorModeIndex = this.getParameterIndex('sensor_mode') || 2;
		const sensorModeValue = parseInt(previousSensorMode, 10);
		
		await this.configurationSet({ 
			index: sensorModeIndex,
			size: 1,
			signed: false
		}, sensorModeValue);
		
		await this.setSettings({ sensor_mode: previousSensorMode })
			.catch(err => this.error(`Failed to update sensor_mode setting: ${err.message}`));
	}

	async initializeDeviceState() {
		try {
			const settings = await this.getSettings();
			const sensorMode = parseInt(settings.sensor_mode, 10);
			
			// Update the selected temperature capability
			await this.updateSelectedTemperatureCapability(sensorMode);
			
			// Check if device is in power regulator mode
			if (sensorMode === 5) {
				await this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions);
				await this.setCapabilityValue('thermostat_mode', 'Powerregulator');
				
				const powerRegValue = settings.power_reg_active_time || 
									 this.getStoreValue('power_reg_value') || 5;
				await this.setCapabilityValue('target_temperature', powerRegValue * 10);
			} else {
				await this.setCapabilityOptions('target_temperature', this._originalTempOptions);
				
				// Handle exiting from powerregulator mode if needed
				const currentMode = this.getCapabilityValue('thermostat_mode');
				if (currentMode === 'Powerregulator') {
					const storedMode = await this.getStoreValue('thermostat_mode') || 'heat';
					await this.setCapabilityValue('thermostat_mode', storedMode);
					
					// Restore temperature setpoint
					const setpointType = Mode2Setpoint[storedMode];
					if (setpointType && setpointType !== 'not supported') {
						const storedTemp = await this.getStoreValue(`thermostatsetpointValue.${setpointType}`) || 21;
						await this.setCapabilityValue('target_temperature', storedTemp);
					}
				}
			}
		} catch (err) {
			this.error(`Error initializing device state: ${err.message}`);
		}
	}

	async initPowerRegulatorMode() {
		try {
			if (this.getCapabilityValue('thermostat_mode') !== 'Powerregulator') return;
			
			await this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions);
			
			// Try to get current value from device
			const powerRegIndex = this.getParameterIndex('power_reg_active_time');
			if (powerRegIndex !== null) {
				try {
					const result = await this.node.CommandClass.COMMAND_CLASS_CONFIGURATION.CONFIGURATION_GET({
						'Parameter Number': powerRegIndex
					});
					
					if (result) {
						const confValRaw = result['Configuration Value (Raw)'];
						const { paramSize, isSigned } = this.getParameterInfo(powerRegIndex);
						const parsedValue = this.parseConfigurationValue(confValRaw, paramSize, isSigned);
						
						if (parsedValue !== null) {
							await this.setStoreValue('power_reg_value', parsedValue);
							await this.setSettings({ power_reg_active_time: parsedValue });
							await this.setCapabilityValue('target_temperature', parsedValue * 10);
							return;
						}
					}
				} catch (configError) {
					this.error(`Error getting configuration: ${configError.message}`);
				}
			}
			
			// Fallback - use stored value
			const powerRegValue = this.getPowerRegulatorValue();
			await this.setCapabilityValue('target_temperature', powerRegValue * 10);
		} catch (error) {
			this.error(`Error in initPowerRegulatorMode: ${error.message}`);
		}
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		if (super.onSettings) {
			await super.onSettings({ oldSettings, newSettings, changedKeys });
		}

		if (changedKeys.includes('sensor_mode')) {
			const sensorMode = parseInt(newSettings.sensor_mode, 10);
			await this.updateSelectedTemperatureCapability(sensorMode);
			await this.handleThermostatModeForSensorMode(sensorMode);
		}

		return true;
	}

	async handleThermostatModeForSensorMode(sensorMode) {
		if (sensorMode === 5) {
			if (this.getCapabilityValue('thermostat_mode') !== 'Powerregulator') {
				await this.handleEnterPowerRegulatorMode();
			}
		} else if (this.getCapabilityValue('thermostat_mode') === 'Powerregulator') {
			await this.handleExitPowerRegulatorMode();
			
			// Restore previous mode
			const previousMode = await this.getStoreValue('thermostat_mode') || 'heat';
			await this.setCapabilityValue('thermostat_mode', previousMode);
			
			// Restore previous setpoint
			const setpointType = Mode2Setpoint[previousMode];
			if (setpointType && setpointType !== 'not supported') {
				const previousSetpoint = await this.getStoreValue(`thermostatsetpointValue.${setpointType}`) || 21;
				await this.setCapabilityValue('target_temperature', previousSetpoint);
			}
		}
	}

	handleThermostatModeReport(mode) {
		if (typeof mode !== 'string' || !this.ThermostatModeToCapability[mode]) {
			return null;
		}
		
		const capabilityMode = this.ThermostatModeToCapability[mode];
		
		// Check if device is in power regulator mode
		const settings = this.getSettings();
		if (settings?.sensor_mode === '5') {
			// Store actual mode but keep UI showing 'Powerregulator'
			if (capabilityMode !== 'Powerregulator') {
				this.setStoreValue('thermostat_mode', capabilityMode)
					.catch(err => this.error(`Failed to store thermostat_mode: ${err.message}`));
			}
			
			// Ensure UI shows power regulator mode
			setTimeout(() => {
				this.setCapabilityValue('thermostat_mode', 'Powerregulator')
					.catch(err => this.error(`Failed to set thermostat_mode: ${err.message}`));
				
				const powerRegValue = this.getPowerRegulatorValue();
				this.setCapabilityValue('target_temperature', powerRegValue * 10)
					.catch(err => this.error(`Failed to update target_temperature: ${err.message}`));
			}, 500);
			
			return 'Powerregulator';
		}
		
		// Normal mode handling
		this.setStoreValue('thermostat_mode', capabilityMode)
			.catch(err => this.error(`Failed to store thermostat_mode: ${err.message}`));
		
		return capabilityMode;
	}

	async updateSelectedTemperatureCapability(sensorMode) {
		const selectedCapability = this.PARAM2_SENSOR_MAP[sensorMode] || 'measure_temperature.internal';
		await this.setStoreValue('selectedTemperatureCapability', selectedCapability);
		
		// Update the main temperature with value from selected sensor
		const latestValue = this.getCapabilityValue(selectedCapability);
		await this.setCapabilityValue('measure_temperature', latestValue)
			.catch(err => this.error(`Failed to update measure_temperature: ${err.message}`));
		
		return selectedCapability;
	}

	getPowerRegulatorValue() {
		const settings = this.getSettings();
		if (settings?.power_reg_active_time) {
			return parseInt(settings.power_reg_active_time, 10);
		}
		
		const storedValue = this.getStoreValue('power_reg_value');
		return storedValue !== null ? parseInt(storedValue, 10) : 5;
	}

	getParameterIndex(settingId) {
		const setting = this.getManifestSettings().find(s => s.id === settingId);
		return setting?.zwave?.index || null;
	}

	getParameterInfo(paramNum) {
		const setting = this.getManifestSettings().find(s => 
			s.zwave && s.zwave.index === paramNum
		);
		
		return {
			matchingSetting: setting,
			paramSize: setting?.zwave?.size || 1,
			isSigned: !(setting?.zwave?.signed === false)
		};
	}

	parseConfigurationValue(confValRaw, paramSize, isSigned) {
		let valueBuffer;
		
		if (Buffer.isBuffer(confValRaw)) {
			valueBuffer = confValRaw;
		} else if (confValRaw && Array.isArray(confValRaw.data)) {
			valueBuffer = Buffer.from(confValRaw.data);
		} else {
			return null;
		}
		
		// Read the appropriate bytes based on size
		if (paramSize === 1) {
			return isSigned ? valueBuffer.readInt8(0) : valueBuffer.readUInt8(0);
		} else if (paramSize === 2) {
			return isSigned ? valueBuffer.readInt16BE(0) : valueBuffer.readUInt16BE(0);
		} else if (paramSize === 4) {
			return isSigned ? valueBuffer.readInt32BE(0) : valueBuffer.readUInt32BE(0);
		}
		
		return null;
	}

	async handleConfigurationReport(report) {
		try {
			const paramNum = report['Parameter Number'];
			const confValRaw = report['Configuration Value (Raw)'];
			
			// Skip invalid reports
			if (paramNum === undefined || !confValRaw) return;
			
			const { matchingSetting, paramSize, isSigned } = this.getParameterInfo(paramNum);
			const parsedValue = this.parseConfigurationValue(confValRaw, paramSize, isSigned);
			
			if (parsedValue === null) return;
			
			// Handle specific parameters
			if (paramNum === this.getParameterIndex('sensor_mode')) {
				await this.setSettings({ sensor_mode: String(parsedValue) });
				await this.updateSelectedTemperatureCapability(parsedValue);
				await this.handleThermostatModeForSensorMode(parsedValue);
				
			} else if (paramNum === this.getParameterIndex('power_reg_active_time')) {
				await this.setStoreValue('power_reg_value', parsedValue);
				await this.setSettings({ power_reg_active_time: parsedValue });
				
				if (this.getCapabilityValue('thermostat_mode') === 'Powerregulator') {
					await this.setCapabilityValue('target_temperature', parsedValue * 10);
				}
				
			} else if (matchingSetting) {
				// Generic parameter handling
				let settingValue = parsedValue;
				
				if (matchingSetting.type === 'checkbox') {
					settingValue = Boolean(parsedValue);
				} else if (matchingSetting.type === 'dropdown') {
					settingValue = String(parsedValue);
				}
				
				await this.setSettings({ [matchingSetting.id]: settingValue });
			}
		} catch (error) {
			this.error(`Error processing configuration report: ${error.message}`);
		}
	}
}

module.exports = ZTRM6Device;