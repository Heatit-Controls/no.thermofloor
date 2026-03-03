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
  EcoCool: {
    Mode: 'energy save cool',
    Setpoint: 'Energy Save Cooling',
    Setting: 'ESC_setpoint',
    Parameter: '17',
    Mode_no: '4',
  },
  Auto: {
    Mode: 'auto changeover',
    Setpoint: 'Auto Changeover',
    Setting: 'AUTO_setpoint',
    Parameter: '18',
    Mode_no: '5',
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

module.exports = {
  Mode2Setpoint,
  Setpoint2Setting,
};
