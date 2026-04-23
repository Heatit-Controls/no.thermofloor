'use strict';

const Modes = {
	'off':              { setpoint: 'not supported' },
	'heat':             { setpoint: 'Heating 1',           setting: 'HEAT_setpoint' },
	'cool':             { setpoint: 'Cooling 1',           setting: 'COOL_setpoint' },
	'energy save heat': { setpoint: 'Energy Save Heating', setting: 'ECO_setpoint' },
	'energy save cool': { setpoint: 'Energy Save Cooling', setting: 'ESC_setpoint' },
	'auto changeover':  { setpoint: 'Auto changeover',     setting: 'AUTO_setpoint' },
	'fan only':         { setpoint: 'not supported' },
};

function buildMappings(modes) {
	const Mode2Setpoint = {};
	const Setpoint2Setting = {};
	for (const mode of modes) {
		const entry = Modes[mode];
		Mode2Setpoint[mode] = entry.setpoint;
		if (entry.setting) Setpoint2Setting[entry.setpoint] = entry.setting;
	}
	return { Mode2Setpoint, Setpoint2Setting };
}

module.exports = { buildMappings };
