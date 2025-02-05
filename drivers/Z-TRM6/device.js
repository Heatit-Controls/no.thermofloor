'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const Homey = require('homey');

const ThermostatFourModeDevice = require('../../lib/ThermostatFourModeDevice');
// Import Mode2Setpoint from mappings file
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

let timer = null;

ZwaveDevice.setMaxListeners(20);

class ZTRM6Device extends ThermostatFourModeDevice {
	async onNodeInit() {

		// Mapping of parameter 2 values to sensor capabilities:
		//  1 => Floor sensor
		//  2 or 3 => Internal sensor
		//  4 or 5 => External sensor
		//  6 => No sensor (null)
		this.PARAM2_SENSOR_MAP = {
			0: 'measure_temperature.floor',
			1: 'measure_temperature.internal',
			2: 'measure_temperature.internal',
			3: 'measure_temperature.external',
			4: 'measure_temperature.external',
			5: 'measure_temperature.internal',
		};
		

		// Default selected sensor (internal sensor)
		this.selectedTemperatureCapability = 'measure_temperature.internal';

		this.capabilityMultiChannelNodeIdObj = {
			'measure_temperature.internal': 2,
			'measure_temperature.external': 3,
			'measure_temperature.floor': 4,
		};

		// Example (commented-out) capabilities for power measurements…
		/*
		this.registerCapability('measure_power', 'METER', {
			report: 'METER_REPORT',
			reportParserV5: report => {
				const bool = report && report.hasOwnProperty('Properties2')
					&& report.Properties2['Scale bits 10'] === 2
				this.log("measure_power" , bool)
				if (bool) {
					this.log("measure_power" , report['Meter Value (Parsed)'])
					return report['Meter Value (Parsed)'];
				}
				return 0
			},
			multiChannelNodeId: 1,
		});
		this.registerCapability('meter_power', 'METER', {
			report: 'METER_REPORT',
			reportParserV5: report => {
				const bool = report && report.hasOwnProperty('Properties2')
					&& report.Properties2['Scale bits 10'] === 0
				this.log("meter_power" , bool)
				if (bool) {
					this.log("meter_power" , report['Meter Value (Parsed)'])
					return report['Meter Value (Parsed)'];
				}
				return 0
			},
			multiChannelNodeId: 1,
		});
		*/

		// Listen for multi-channel meter reports
		this.registerMultiChannelReportListener(1, "METER", "METER_REPORT", report => {
			const bool = report && report.hasOwnProperty('Properties2');
			this.log("METER_REPORT", report);
			if (bool && report.Properties2['Scale bits 10'] === 0) {
				this.log("meter_power", report['Meter Value (Parsed)']);
				this.setCapabilityValue('meter_power', report['Meter Value (Parsed)']).catch(this.error);
			} else if (bool && report.Properties2['Scale bits 10'] === 2) {
				this.log("measure_power", report['Meter Value (Parsed)']);
				this.setCapabilityValue('measure_power', report['Meter Value (Parsed)']).catch(this.error);
			}
		});

		// Register the main measure_temperature capability (for backwards compatibility)
		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: {
				getOnStart: true,
			},
			getParser: () => {
				// Retrieve the setpointType based on the thermostat mode
				const setpointType = Mode2Setpoint[this.getCapabilityValue('thermostat_mode') || 'Heat'];
				// Return getParser object with correct setpointType
				return {
					Level: {
						'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
					},
				};
			},
			set: 'THERMOSTAT_SETPOINT_SET',
			setParserV3: setpointValue => {
				this.log('Mode2Setpoint', setpointValue, this.getCapabilityValue('thermostat_mode'), Mode2Setpoint[this.getCapabilityValue('thermostat_mode') || 'Heat']);
				const setpointType = Mode2Setpoint[this.getCapabilityValue('thermostat_mode') || 'Heat'];
				this.log('Setting thermostat setpoint to:', setpointValue, 'for setpointType', setpointType);
				if (setpointType !== 'not supported') {
					// Store thermostat setpoint based on thermostat type
					this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);
					// Update device settings setpoint value
					const setpointSetting = Setpoint2Setting[setpointType];
					this.setSettings({
						[setpointSetting]: setpointValue * 10,
					}).catch(this.error);
					// Prepare the buffer value
					const bufferValue = Buffer.alloc(2);
					bufferValue.writeUInt16BE((Math.round(setpointValue * 2) / 2 * 10).toFixed(0));
					this.log('Set thermostat setpointValue:', setpointValue, setpointValue * 10, (Math.round(setpointValue * 2) / 2 * 10).toFixed(0), bufferValue);
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
				if (report && report.hasOwnProperty('Level2')
					&& report.Level2.hasOwnProperty('Scale')
					&& report.Level2.hasOwnProperty('Precision')
					&& report.Level2.Scale === 0
					&& typeof report.Level2.Size !== 'undefined') {
					let readValue;
					try {
						readValue = report.Value.readUIntBE(0, report.Level2.Size);
					} catch (err) {
						return null;
					}
					if (typeof readValue !== 'undefined') {
						const setpointValue = readValue / 10 ** report.Level2.Precision;
						const setpointType = report.Level['Setpoint Type'];
						this.log('Received thermostat setpoint report: Setpoint type', setpointType, ' Setpoint value', setpointValue);
						if (setpointType !== 'not supported') {
							this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpointValue).catch(this.error);
						}
						const setpointSetting = Setpoint2Setting[setpointType];
						this.setSettings({
							[setpointSetting]: setpointValue * 10,
						}).catch(this.error);
						if (setpointType === Mode2Setpoint[this.getCapabilityValue('thermostat_mode') || 'Heat']) {
							this.log('Updated thermostat setpoint on UI to', setpointValue);
							return setpointValue;
						}
						return null;
					}
					return null;
				}
				return null;
			},
			multiChannelNodeId: 1,
		});

        
		this.registerReportListener('CONFIGURATION', 'CONFIGURATION_REPORT', async report => {
			try {
				if (report?.['Parameter Number'] !== 2) {
					this.log(`Ignoring CONFIGURATION_REPORT - Parameter ${report?.['Parameter Number']}`);
					return; // Skip processing for other parameters
				}
		
				// Get the raw value, handling both Buffer and plain object (if needed)
				let rawValue;
				const confValRaw = report['Configuration Value (Raw)'];
				if (Buffer.isBuffer(confValRaw)) {
					// Convert the Buffer to an array of numbers
					rawValue = Array.from(confValRaw);
				} else if (confValRaw && Array.isArray(confValRaw.data)) {
					// If it happens to be a plain object with a data property
					rawValue = confValRaw.data;
				} else {
					this.log(`Invalid Configuration Value format: ${JSON.stringify(report, null, 2)}`);
					return;
				}
		
				const parsedValue = rawValue[0];
		
				this.log(`Updating settings - Parameter 2: ${parsedValue}`);
		
				// Store the parameter value into settings
				await this.setSettings({
					sensor_mode: String(parsedValue)
				});
		
				this.log(`Settings updated: sensor_mode = ${parsedValue}`);
			} catch (error) {
				this.log(`Error processing CONFIGURATION_REPORT: ${error.message}`);
			}
		});
		
        
    
		await this.registerThermostatModeCapability();
		await this.registerTemperature();

		this.log('Z-TRM6 has been initialized');
		this.setAvailable().catch(this.error);
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		if (changedKeys.includes('sensor_mode')) {
		  // Convert the sensor_mode setting value to a number.
		  const sensorMode = parseInt(newSettings.sensor_mode, 10);
		  // Update the internal property to select which sensor value should be used for measure_temperature.
		  this.selectedTemperatureCapability = this.PARAM2_SENSOR_MAP[sensorMode] || 'measure_temperature.internal';
		  this.log(`Sensor mode changed to ${sensorMode}. Selected temperature capability set to: ${this.selectedTemperatureCapability}`);
		}
	  
		// If your parent class has its own onSettings implementation, call it:
		if (super.onSettings) {
		  return super.onSettings({ oldSettings, newSettings, changedKeys });
		}
		return Promise.resolve(true);
	  }
	  

	onDeleted() {
		this.homey.clearInterval(timer);
		super.onDeleted();
	}

	// Modified registerTemperature method to update main measure_temperature
	// only when the reporting sensor is the one selected.
	async registerTemperature() {
		Object.keys(this.capabilityMultiChannelNodeIdObj).forEach(capabilityId => {
			if (capabilityId.includes('measure_temperature')) {
				const subName = capabilityId.split('.')[1];
				// If no subName (main capability) exists, register normally…
				if (this.hasCapability(capabilityId) && subName === undefined) {
					this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
						getOpts: { getOnStart: true },
						multiChannelNodeId: this.capabilityMultiChannelNodeIdObj[capabilityId],
					});
				} else if (this.hasCapability(capabilityId) && subName !== undefined) {
					this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
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
									// Only update the main measure_temperature if this sensor is selected.
									if (capabilityId === this.selectedTemperatureCapability) {
										this.setCapabilityValue('measure_temperature', report['Sensor Value (Parsed)']).catch(this.error);
									}
									return report['Sensor Value (Parsed)'];
								}
							}
							return null;
						},
						multiChannelNodeId: this.capabilityMultiChannelNodeIdObj[capabilityId],
					});
				}
			}
		});
	}

	registerThermostatModeCapability() {
		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: {
				getOnStart: true,
			},
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => {
				if (!CapabilityToThermostatMode.hasOwnProperty(value)) {
					return null;
				}
				const mode = CapabilityToThermostatMode[value];
				if (typeof mode !== 'string') {
					return null;
				}
				return {
					'Level': {
						'No of Manufacturer Data fields': 0,
						'Mode': mode,
					},
					'Manufacturer Data': Buffer.from([]),
				};
			},
			report: 'THERMOSTAT_MODE_REPORT',
			reportParser: report => {
				this.log('Thermostat mode report:', report);
				if (report && report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Mode')) {
					const mode = report.Level.Mode;
					if (typeof mode === 'string' && ThermostatModeToCapability.hasOwnProperty(mode)) {
						const capabilityMode = ThermostatModeToCapability[mode];
						this.log('Capability Mode ', capabilityMode);
						return capabilityMode;
					}
				}
				return null;
			},
			multiChannelNodeId: 1,
		});
		this.registerCapability('thermostat_state_13570', 'THERMOSTAT_OPERATING_STATE', {
			getOpts: {
				getOnStart: true,
			},
			get: 'THERMOSTAT_OPERATING_STATE_GET',
			report: 'THERMOSTAT_OPERATING_STATE_REPORT',
			reportParser: report => {
				this.log('THERMOSTAT_OPERATING_STATE report:', report);
				if (report && report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Operating State')) {
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
			multiChannelNodeId: 1,
		});

		this.setAvailable().catch(this.error);

		// Register the target temperature capability and setpoint types
		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: {
				getOnStart: true,
			},
			getParser: () => {
				const thermostatMode = this.getCapabilityValue('thermostat_mode') || 'Heat';
				const setpointType = Mode2Setpoint[thermostatMode];
				if (!setpointType) {
					this.error(`Setpoint type for mode "${thermostatMode}" is undefined`);
					return null;
				}
				this.log('Current mode:', thermostatMode, 'Setpoint type:', setpointType);
				return {
					Level: {
						'Setpoint Type': setpointType !== 'not supported' ? setpointType : 'Heating 1',
					},
				};
			},
			set: 'THERMOSTAT_SETPOINT_SET',
			setParserV3: setpointValue => {
				const thermostatMode = (this.getCapabilityValue('thermostat_mode') || 'heat').toLowerCase();
				const setpointType = Mode2Setpoint[thermostatMode];
				this.log('Current mode is:', thermostatMode, 'Mapped to Setpoint type:', setpointType);
				if (!setpointType) {
					this.error(`Setpoint type for mode "${thermostatMode}" is undefined`);
					return null;
				}
				this.log('Setting thermostat setpoint to:', setpointValue, 'for setpointType', setpointType);
				if (setpointType !== 'not supported') {
					const bufferValue = Buffer.alloc(2);
					bufferValue.writeUInt16BE((Math.round(setpointValue * 2) / 2 * 10).toFixed(0));
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
		});
	}
}

module.exports = ZTRM6Device;
