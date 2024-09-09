'use strict';

const MasterData = {
  Heat: {
    Mode: 'heat',
    Setpoint: 'Heating 1',
    Setting: 'HEAT_setpoint',
    Parameter: '14',
    Mode_no: '1',
  },
  Off: {
    Mode: 'off',
    Setpoint: 'not supported',
    Mode_no: '0',
  },
  Cool: {
    Mode: 'cool',
    Setpoint: 'Cooling 1',
    Setting: 'COOL_setpoint',
    Parameter: '15',
    Mode_no: '2',
  },
  Eco: {
    Mode: 'energy save heat',
    Setpoint: 'Energy Save Heating',
    Setting: 'ECO_setpoint',
    Parameter: '16',
    Mode_no: '3',
  },
};

// Create mapMode2Setting array based on MasterData array
const Mode2Setting = {};
for (const mode in MasterData) {
  if (MasterData[mode].Setting) {
    Mode2Setting[MasterData[mode].Mode] = MasterData[mode].Setting;
  }
}

// Create mapMode2Setpoint array based on MasterData array
const Mode2Setpoint = {};
for (const mode in MasterData) {
  if (MasterData[mode].Setpoint) {
    Mode2Setpoint[MasterData[mode].Mode] = MasterData[mode].Setpoint;
  }
}

// Create mapSetpoint2Setting array based on MasterData array
const Setpoint2Setting = {};
for (const mode in MasterData) {
  if (MasterData[mode].Setpoint && MasterData[mode].Setting) {
    Setpoint2Setting[MasterData[mode].Setpoint] = MasterData[mode].Setting;
  }
}

// Create mapMode2Number array based on MasterData array
const Mode2Number = {};
for (const mode in MasterData) {
  if (MasterData[mode].Mode_no) {
    Mode2Number[MasterData[mode].Mode] = MasterData[mode].Mode_no;
  }
}

module.exports = {
  Mode2Setpoint: {
    'Heat': 'Heating',          // Setpoint type for Heating mode
    'Cool': 'Cooling',          // Setpoint type for Cooling mode
    'Energy Save Heat': 'Energy Saving Heating', // Setpoint type for Energy-saving heating mode
    'Off': 'not supported',       // Off mode doesn't have a setpoint
  },
  Mode2Setpoint,
  Setpoint2Setting,
  Mode2Number,
};
