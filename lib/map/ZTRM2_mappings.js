'use strict';

const MasterData = {
  'Energy Save Heat': {
    Mode: 'Energy Save Heat',
    Setpoint: 'Energy Save Heating',
    Setting: 'ECO_setpoint',
    Parameter: '10',
    Mode_no: '11',
  },
  Heat: {
    Mode: 'Heat',
    Setpoint: 'Heating 1',
    Setting: 'CO_setpoint',
    Parameter: '9',
    Mode_no: '1',
  },
  Cool: {
    Mode: 'Cool',
    Setpoint: 'Cooling 1',
    Setting: 'COOL_setpoint',
    Parameter: '11',
    Mode_no: '2',
  },
  Off: {
    Mode: 'Off',
    Mode_no: '0',
    Setpoint: 'not supported',
  },
};

// Create mapMode2Setting array based on MasterData array
const Mode2Setting = {};
for (const mode in MasterData) {
  Mode2Setting[MasterData[mode].Mode] = MasterData[mode].Setting;
}

// Create mapMode2Setpoint array based on MasterData array
const Mode2Setpoint = {};
for (const mode in MasterData) {
  Mode2Setpoint[MasterData[mode].Mode] = MasterData[mode].Setpoint;
}

// Create mapSetpoint2Setting array based on MasterData array
const Setpoint2Setting = {};
for (const mode in MasterData) {
  Setpoint2Setting[MasterData[mode].Setpoint] = MasterData[mode].Setting;
}

// Create mapMode2Number array based on MasterData array
const Mode2Number = {};
for (const mode in MasterData) {
  Mode2Number[MasterData[mode].Mode] = MasterData[mode].Mode_no;
}

module.exports = {
  Mode2Setting,
  Mode2Setpoint,
  Setpoint2Setting,
  Mode2Number,
};
