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
	}

	async onNodeInit() {
		//this.enableDebug();
		//this.printNode();

		this.registerReportListener('CONFIGURATION', 'CONFIGURATION_REPORT', async report => {
			try {
				await this.handleConfigurationReport(report);
			} catch (err) {
				this.error(`Error in CONFIGURATION_REPORT handler: ${err.message}`);
			}
		});


		if (this.hasCapability('thermostat_state_IdleHeatCool') === false) {
			await this.addCapability('thermostat_state_IdleHeatCool');
		}
		if (this.hasCapability('thermostat_state_13570') === true) {
			await this.removeCapability('thermostat_state_13570');
		}

		if (this.hasCapability('powerregulator_mode') === true) {
			await this.removeCapability('powerregulator_mode');
		}

		this._originalTempOptions = {
			min: 5,
			max: 40,
			step: 0.5
		};

		this._powerRegulatorTempOptions = {
			min: 10,
			max: 100,
			step: 10
		};

		const storedPowerRegValue = this.getStoreValue('power_reg_value');
		if (storedPowerRegValue === null || storedPowerRegValue === undefined) {
			await this.setStoreValue('power_reg_value', 5); // Default to middle value (5 = 50%)
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


		this.registerCapability('measure_temperature.internal', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
			report: 'SENSOR_MULTILEVEL_REPORT',
			reportParser: report => {
				if (this.selectedTemperatureCapability === 'measure_temperature.internal') {
					this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)'])
						.catch(this.error);
				}
				return report['Sensor Value (Parsed)'];
			},
			multiChannelNodeId: 2
		});

		this.registerCapability('measure_temperature.external', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
			report: 'SENSOR_MULTILEVEL_REPORT',
			reportParser: report => {
				if (this.selectedTemperatureCapability === 'measure_temperature.external') {
					this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)'])
						.catch(this.error);
				}
				return report['Sensor Value (Parsed)'];
			},
			multiChannelNodeId: 3
		});

		this.registerCapability('measure_temperature.floor', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
			report: 'SENSOR_MULTILEVEL_REPORT',
			reportParser: report => {
				if (this.selectedTemperatureCapability === 'measure_temperature.floor') {
					this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)'])
						.catch(this.error);
				}
				return report['Sensor Value (Parsed)'];
			},
			multiChannelNodeId: 4
		});

		if (this.hasCapability('measure_temperature') === false) {
			await this.addCapability('measure_temperature');
		}

		const selectedSensor = this.getStoreValue('selectedTemperatureCapability') || 'measure_temperature.internal';
		const currentValue = this.getCapabilityValue(selectedSensor);
		if (currentValue !== null) {
			await this.setCapabilityValue('measure_temperature', currentValue);
		}

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
			get: async (options) => {
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

				if (currentMode === 'Powerregulator') {
					// When in powerregulator mode, use target_temperature directly as the powerregulator level
					// We're limiting the value to 10-100 range (steps of 10)
					let powerRegValue = Math.round(setpointValue / 10) * 10;
					powerRegValue = Math.max(10, Math.min(100, powerRegValue));
					this.setStoreValue('power_reg_value', powerRegValue).catch(this.error);
					this.setSettings({ power_reg_active_time: powerRegValue / 10 }).catch(err => {
						this.error(`Failed to update power_reg_active_time setting: ${err.message}`);
					});

					this.configurationSet({
						index: this.getParameterIndex('power_reg_active_time'),
						size: 0x01,
						signed: false
					}, powerRegValue / 10); // /10 to convert 10-100 to 1-10 in parameter values
					return null;
				}

				const setpointType = Mode2Setpoint[currentMode];

				if (setpointType !== 'not supported' && setpointType) {
					this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);

					const setpointSetting = Setpoint2Setting[setpointType];
					this.setSettings({
						[setpointSetting]: setpointValue * 10,
					}).catch(this.error);

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
					const currentMode = this.getCapabilityValue('thermostat_mode');

					if (currentMode === 'Powerregulator') {
						return null;
					}

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
							this.setSettings({ [setpointSetting]: setpointValue * 10 })
								.catch(err => this.error(`Failed to update setpoint setting: ${err.message}`));

							// Only update UI if the report type matches current mode
							if (setpointType === Mode2Setpoint[currentMode]) {
								return setpointValue;
							}
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
			getOpts: {
				getOnStart: true,
			},
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => {
				if (value === 'Powerregulator') {
					const currentMode = this.getCapabilityValue('thermostat_mode');
					if (currentMode && currentMode !== 'Powerregulator') {
						this.log(`Saving previous thermostat mode: ${currentMode}`);
						this.setStoreValue('thermostat_mode', currentMode).catch(this.error);
						const settings = this.getSettings();
						if (settings && settings.sensor_mode && settings.sensor_mode !== '5') {
							this.log(`Saving previous sensor mode: ${settings.sensor_mode}`);
							this.setStoreValue('previous_sensor_mode', settings.sensor_mode).catch(this.error);
						}
					}

					this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions)
						.then(() => {
							const powerRegValue = this.getPowerRegulatorValue();
							this.setCapabilityValue('target_temperature', powerRegValue * 10).catch(this.error);
						})
						.catch(this.error);

					// Find sensor_mode parameter index
					const sensorModeIndex = this.getParameterIndex('sensor_mode');
					// Find power regulator mode value (PWER)
					// Change the sensor_mode parameter to power regulator mode
					try {
						this.configurationSet({
							index: sensorModeIndex || 2, // Fallback to 2 if not found
							size: 1,  // Size in bytes
							signed: false
						}, 5);

						// Update the sensor_mode setting in the device settings
						this.setSettings({
							sensor_mode: String(5) // Update the setting to match the configuration
						}).catch(err => {
							this.error(`Failed to update sensor_mode setting: ${err.message}`);
						});
					} catch (error) {
						this.error(`Failed to set power regulator mode: ${error.message}`);
					}

					// Don't send thermostat mode command
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
			multiChannelNodeId: 1,
		});

		// Register capability listener for reset meter button
		this.registerCapabilityListener('button.reset_meter', async () => {
			let commandClassMeter = this.getCommandClass('METER');
			if (commandClassMeter && commandClassMeter.hasOwnProperty('METER_RESET')) {
				const result = await commandClassMeter.METER_RESET({});
				if (result !== 'TRANSMIT_COMPLETE_OK') throw result;
			} else {
				throw new Error('Reset meter not supported');
			}
		});
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

	async handleEnterPowerRegulatorMode() {
		try {
			// Save current thermostat mode before entering power regulator mode
			const currentMode = this.getCapabilityValue('thermostat_mode');
			if (currentMode && currentMode !== 'Powerregulator') {
				this.log(`Saving previous thermostat mode: ${currentMode}`);
				await this.setStoreValue('thermostat_mode', currentMode);

				const settings = this.getSettings();
				if (settings && settings.sensor_mode && settings.sensor_mode !== '5') {
					this.log(`Saving previous sensor mode: ${settings.sensor_mode}`);
					await this.setStoreValue('previous_sensor_mode', settings.sensor_mode);
				}
			}

			// Set power regulator temperature options
			await this.setCapabilityOptions('target_temperature', this._powerRegulatorTempOptions);

			// Update the target temperature to show power regulator value
			const powerRegValue = this.getPowerRegulatorValue();
			await this.setCapabilityValue('target_temperature', powerRegValue * 10);

			// Set sensor mode to power regulator (5)
			const sensorModeIndex = this.getParameterIndex('sensor_mode') || 2;
			await this.configurationSet({
				index: sensorModeIndex,
				size: 1,
				signed: false
			}, 5);

			// Update the sensor_mode setting
			await this.setSettings({ sensor_mode: '5' });
		} catch (error) {
			this.error(`Error entering power regulator mode: ${error.message}`);
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
		const manifestSettings = this.getManifestSettings();
		const matchingSetting = manifestSettings.find(setting =>
			setting.zwave && setting.zwave.index === paramNum
		);

		const paramSize = matchingSetting?.zwave?.size || 1;
		const isSigned = !(matchingSetting?.zwave?.signed === false);

		return { matchingSetting, paramSize, isSigned };
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

			const { matchingSetting, paramSize, isSigned } = this.getParameterInfo(paramNum);
			const parsedValue = this.parseConfigurationValue(confValRaw, paramSize, isSigned);

			if (parsedValue === null) return;
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
				await this.processGenericParameter(paramNum, parsedValue, matchingSetting);
			}
		} catch (error) {
			this.error(`Error processing configuration report: ${error.message}`);
		}
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
}

module.exports = ZTRM6Device;