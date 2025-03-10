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
		// this.enableDebug();
		
		// print the node's info to the console
		this.printNode();
		
		// register capabilities for this device
		this.registerCapability('measure_temperature.internal', 'SENSOR_MULTILEVEL');
		this.registerCapability('measure_temperature.external', 'SENSOR_MULTILEVEL');
		this.registerCapability('measure_temperature.floor', 'SENSOR_MULTILEVEL');

		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT');
		
		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE');
		this.registerCapability('thermostat_state', 'THERMOSTAT_OPERATING_STATE');


		this.registerCapabilityListener('meter_power')
		this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
	}
}

module.exports = ZTRM6Device;
