'use strict';

const Homey = require('homey');

class HeatitApp extends Homey.App {

  onInit() {
    this.log(`${Homey.manifest.id} running...`);

    this.triggerMeasureTemperatureFloor = this.homey.flow.getDeviceTriggerCard('measure_temperature.floor_changed');
    this.triggerMeasureTemperatureExternal = this.homey.flow.getDeviceTriggerCard('measure_temperature.external_changed');
    this.triggerMeasureTemperatureInternal = this.homey.flow.getDeviceTriggerCard('measure_temperature.internal_changed');
    this.triggerMeasureTemperatureInput1 = this.homey.flow.getDeviceTriggerCard('measure_temperature.input1_changed');
    this.triggerMeasureTemperatureInput2 = this.homey.flow.getDeviceTriggerCard('measure_temperature.input2_changed');
    this.triggerMeasureTemperatureInput3 = this.homey.flow.getDeviceTriggerCard('measure_temperature.input3_changed');
    this.triggerMeasureTemperatureInput4 = this.homey.flow.getDeviceTriggerCard('measure_temperature.input4_changed');

    // thermostat_state_changed_to
    this.triggerThermostatStateChangedTo = this.homey.flow.getDeviceTriggerCard('thermostat_state_changed_to')
      .registerRunListener(async (args, state) => {
        return args.state === state.state;
      });

      // thermofloor_mode_changed
    this.triggerThermofloorModeChanged = this.homey.flow.getDeviceTriggerCard('thermofloor_mode_changed');

    // thermofloor_mode_changed_to
    this.triggerThermofloorModeChangedTo = this.homey.flow.getDeviceTriggerCard('thermofloor_mode_changed_to')
      .registerRunListener(async (args, state) => {
        return args.mode === state.mode;
      });

    // thermostat_mode_changed_to (Autocomplete)
    this.triggerThermostatModeChangedTo = this.homey.flow.getDeviceTriggerCard('thermostat_mode_changed_to')
      .registerRunListener(async (args, state) => {
        return args.mode.id === state.mode;
      });

    this.triggerThermostatModeChangedTo
      .registerArgumentAutocompleteListener('mode', async (query, args) => await args.device.onModeAutocomplete(query, args));

    // thermostat_onoff trigger cards
    this.triggerThermofloorOnoffTrue = this.homey.flow.getDeviceTriggerCard('thermofloor_onoff_true');
    this.triggerThermofloorOnoffFalse = this.homey.flow.getDeviceTriggerCard('thermofloor_onoff_false');

    // thermostat_onoff trigger cards
    this.triggerAlarmPowerTrue = this.homey.flow.getDeviceTriggerCard('alarm_power_true');
    this.triggerAlarmPowerFalse = this.homey.flow.getDeviceTriggerCard('alarm_power_false');

    // Z-button scene trigger cards
    this.triggerZPushButton_scene = this.homey.flow.getDeviceTriggerCard('Z-push-button_scene')
      .registerRunListener(async (args, state) => {
        return (args.button.id === state.button && args.scene.id === state.scene);
      });

    this.triggerZPushButton_scene
      .registerArgumentAutocompleteListener('scene', async (query, args) => await args.device.onSceneAutocomplete(query, args));
    this.triggerZPushButton_scene
      .registerArgumentAutocompleteListener('button', async (query, args) => await args.device.onButtonAutocomplete(query, args));

    // Z-button button trigger cards
    this.triggerZPushButton_button = this.homey.flow.getDeviceTriggerCard('Z-push-button_button');

    // Z-Dim scene trigger cards
    this.triggerZDim_scene = this.homey.flow.getDeviceTriggerCard('Z-dim_scene')
      .registerRunListener(async (args, state) => {
        return args.scene.id === state.scene;
      });

    this.triggerZDim_scene
      .registerArgumentAutocompleteListener('scene', async (query, args) => await args.device.onSceneAutocomplete(query, args));

    // Z-button button trigger cards
    this.triggerZDim_button = this.homey.flow.getDeviceTriggerCard('Z-dim_button');

    // Register conditions for flows
    this.conditionAlarmPower = this.homey.flow.getConditionCard('alarm_power')
      .registerRunListener(async (args, state) => {
        return await args.device.getCapabilityValue('alarm_power');
      });

    // Register conditions for flows
    this.conditionThermofloorOnoffOn = this.homey.flow.getConditionCard('thermofloor_onoff_is_on')
      .registerRunListener(async (args, state) => {
        return await args.device.getCapabilityValue('thermofloor_onoff');
      });

    // Register actions for flows thermofloor_change_mode
    this._actionThermofloorChangeMode = this.homey.flow.getActionCard('thermofloor_change_mode')
      .registerRunListener(async (args, state) => {
        const thermostatMode = args.mode;
        args.device.log('FlowCardAction triggered for ', args.device.getName(), 'to change Thermostat mode to', thermostatMode);

        // Trigger the thermostat mode setParser
        return await args.device.executeCapabilitySetCommand('thermofloor_mode', 'THERMOSTAT_MODE', thermostatMode).catch(this.error);
        // return args.device.triggerCapabilityListener('thermofloor_mode', thermostatMode, {}).catch(this.error);
      });

    // Register actions for flows thermofloor_change_mode (Autocomplete)
    this._actionThermostatChangeMode = this.homey.flow.getActionCard('thermostat_change_mode')
      .registerRunListener(async (args, state) => {
        const thermostatMode = args.mode.id;
        args.device.log('FlowCardAction triggered for ', args.device.getName(), 'to change Thermostat mode to', thermostatMode);

        // Trigger the thermostat mode setParser
        return await args.device.executeCapabilitySetCommand(args.mode.capability, 'THERMOSTAT_MODE', thermostatMode).catch(this.error);
      });

    this._actionThermostatChangeMode
      .registerArgumentAutocompleteListener('mode', async (query, args) => await args.device.onModeAutocomplete(query, args));

    // Register actions for flows
    this._actionThermofloorChangeSetpoint = this.homey.flow.getActionCard('thermofloor_change_mode_setpoint')
      .registerRunListener(this._actionThermofloorChangeSetpointRunListener.bind(this));

    this._actionThermofloorAdjustSetpoint = this.homey.flow.getActionCard('thermofloor_adjust_mode_setpoint')
      .registerRunListener(this._actionThermofloorAdjustSetpointRunListener.bind(this));

    this._setPowerRegulatorMode = this.homey.flow.getActionCard('thermofloor_set_PowerRegulatorMode')
      .registerRunListener(this._setPowerRegulatorMode.bind(this));


    // Register actions for flows thermofloor_change_mode
    this._actionTurnOnSiren = this.homey.flow.getActionCard('turnOnSiren')
      .registerRunListener(this._actionTurnOnOffSirenRunListener.bind(this, true));

    // Register actions for flows thermofloor_change_mode
    this._actionTurnOffSiren = this.homey.flow.getActionCard('turnOffSiren')
      .registerRunListener(this._actionTurnOnOffSirenRunListener.bind(this, false));
  }

  async _actionTurnOnOffSirenRunListener(value, args) {
    if (args && args.device) {
      if (!args.device.hasCommandClass('BASIC')) throw new Error('device_does_not_support_alarm_siren');
      return args.device.executeCapabilitySetCommand('alarm_siren', 'BASIC', value).catch(this.error);
    }
    throw new Error('missing_device_instance');
  }

  // thermofloor_change_mode_setpoint
  async _actionThermofloorChangeSetpointRunListener(args, state) {
    if (!args.hasOwnProperty('setpointMode')) return Promise.reject(new Error('setpointMode_property_missing'));
    if (!args.hasOwnProperty('setpointValue')) return Promise.reject(new Error('setpointValue_property_missing'));
    if (typeof args.setpointValue !== 'number') return Promise.reject(new Error('setpointValue_is_not_a_number'));

    args.device.log('FlowCardAction triggered for ', args.device.getName(), 'to change setpoint value', args.setpointValue, 'for mode', args.setpointMode);
    try {
      return await args.device.executeCapabilitySetCommand('target_temperature', 'THERMOSTAT_SETPOINT', args.setpointValue, { mode: args.setpointMode }).catch(this.error);
    } catch (error) {
      args.device.log(error.message);
      return Promise.reject(new Error(error.message));
    }
  }

  // thermofloor_adjust_mode_setpoint
  async _actionThermofloorAdjustSetpointRunListener(args, state) {
    if (!args.hasOwnProperty('setpointDirection')) return Promise.reject(new Error('setpointDirection_property_missing'));
    if (!args.hasOwnProperty('setpointValue')) return Promise.reject(new Error('setpointValue_property_missing'));
    if (typeof args.setpointValue !== 'number') return Promise.reject(new Error('setpointValue_is_not_a_number'));

    args.device.log('FlowCardAction triggered for ', args.device.getName(), 'to adjust the temperature by', args.setpointValue, ' degrees ', args.setpointDirection);
    
    try {
      let currentSetpointValue = args.device.getCurrentSetpointValue();
      if (currentSetpointValue == null) {
        return Promise.reject(new Error("Current saved temperature is null"));
      }

      let newSetpointValue = parseInt(currentSetpointValue);
      if (newSetpointValue == NaN) {
        return Promise.reject(new Error("Current saved temperature couldn't be parsed"));
      }
      if (args.setpointDirection == "Up") {
        newSetpointValue = currentSetpointValue + args.setpointValue;
        if (newSetpointValue > 40) {
          newSetpointValue = 40;
        }
      } else {
        newSetpointValue = currentSetpointValue - args.setpointValue;
        if (newSetpointValue < 10) {
          newSetpointValue = 10;
        }
      }

      return await args.device.executeCapabilitySetCommand('target_temperature', 'THERMOSTAT_SETPOINT', newSetpointValue, { mode: 'Heat' }).catch(this.error);
    } catch (error) {
      args.device.log(error.message);
      return Promise.reject(new Error(error.message));
    }
  }

  async _setPowerRegulatorMode(args, state) {
    if (!args.hasOwnProperty('set_power_regulator_mode')) return Promise.reject(new Error('set_power_regulator_mode_property_missing'));
    if (typeof args.set_power_regulator_mode !== 'number') return Promise.reject(new Error('set_power_regulator_mode_is_not_a_number'));
    if (args.set_forced_brightness_level > 10) return Promise.reject(new Error('set_power_regulator_mode_out_of_range'));

    try {
      const result = await args.device.configurationSet({
        id: 'P_setting',
      }, args.set_power_regulator_mode);
      return args.device.setSettings({
        P_setting: args.set_power_regulator_mode,
      }).catch(this.error);
    } catch (error) {
      args.device.log(error.message);
      return Promise.reject(new Error(error.message));
    }
  }

}

module.exports = HeatitApp;
