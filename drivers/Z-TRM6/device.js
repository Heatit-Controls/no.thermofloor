'use strict';
const { ZwaveDevice } = require('homey-zwavedriver');
const Homey = require('homey');

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

class ZTRM6Device extends ZwaveDevice {
	async onNodeInit() {
		// enable debug logging
		this.enableDebug();
		
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
		

		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: {
				getOnStart: true,
			},
			set: 'THERMOSTAT_MODE_SET',
			setParser: async value => {
				try {
					if (!CapabilityToThermostatMode.hasOwnProperty(value)) {
						this.error(`Unknown thermostat mode: ${value}`);
						return null;
					}
					
					await this.setStoreValue('current_thermostat_mode', value);
					
					const modeSetpoints = await this.getStoreValue('mode_setpoints') || {};
					const setpoint = modeSetpoints[value];
					
					if (setpoint !== undefined) {
						this.log(`Restoring setpoint ${setpoint} for mode ${value}`);
						
						await this.setCapabilityValue('target_temperature', setpoint);
						
						const setpointTypeMap = {
							'heat': 1,
							'cool': 2,
							'energy save heat': 11,
							'off': 0
						};
						const setpointType = setpointTypeMap[value] || 1;
						
						await this.setStoreValue(`thermostatsetpointValue.${setpointType}`, setpoint);
					}
					
					const mode = CapabilityToThermostatMode[value];
					
					await this.node.CommandClass['COMMAND_CLASS_THERMOSTAT_MODE'].THERMOSTAT_MODE_SET({
						'Level': {
							'No of Manufacturer Data fields': 0,
							'Mode': mode
						},
						'Manufacturer Data': Buffer.from([])
					});
					
					return {
						Level: {
							'No of Manufacturer Data fields': 0,
							'Mode': mode,
						},
						'Manufacturer Data': Buffer.from([]),
					};
				} catch (error) {
					this.error('setParser error', error);
					return null;
				}
			},
			report: 'THERMOSTAT_MODE_REPORT',
			reportParser: report => {
				try {
					this.log('Thermostat mode report:', report);
					if (report && report.Level && report.Level.Mode) {
						const mode = report.Level.Mode;
						if (ThermostatModeToCapability.hasOwnProperty(mode)) {
							const capabilityMode = ThermostatModeToCapability[mode];
							this.log('Thermostat Mode', capabilityMode);
						
							this.setStoreValue('current_thermostat_mode', capabilityMode)
								.catch(err => this.error('Error storing thermostat mode:', err));
							
							return capabilityMode;
						}
					}
					return null;
				} catch (error) {
					this.error('reportParser error:', error);
					return null;
				}
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

		this.setAvailable().catch(this.error);

	}
}

module.exports = ZTRM6Device;
