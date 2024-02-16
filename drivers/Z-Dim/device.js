'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');

const util = require('../../node_modules/homey-zwavedriver/lib/util');

module.exports = class ZDimDevice extends ZwaveDevice {
  async onNodeInit() {
    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    // supported scenes and their reported attribute numbers (all based on reported data)
    this.buttonMap = {
      1: {
        button: 'Dimmer',
      },

    };

    this.sceneMap = {
      'Key Pressed 2 times': {
        scene: 'Key Pressed 2 times',
      },
      'Key Pressed 3 times': {
        scene: 'Key Pressed 3 times',
      },
      'Key Pressed 4 times': {
        scene: 'Key Pressed 4 times',
      },
      'Key Pressed 5 times': {
        scene: 'Key Pressed 5 times',
      },

    };

    this.registerCapability('onoff', 'SWITCH_MULTILEVEL', {
      set: 'SWITCH_MULTILEVEL_SET',
      setParserV4(value, options) {
        return {
          Value: (value) ? 'on/enable' : 'off/disable',
          'Dimming Duration': 'Default',
        };
      },
    });

    this.registerCapability('dim', 'SWITCH_MULTILEVEL', {
      setParserV4(value, options) {
        // containment to create buffer value for 'Dimming Duration' from driver
        const duration = (options.hasOwnProperty('duration') ? new Buffer([util.calculateDimDuration(options.duration)]) : 'Default');
        if (this.hasCapability('onoff')) this.setCapabilityValue('onoff', value > 0).catch(this.error);

        return {
          Value: Math.round(value * 99),
          'Dimming Duration': duration,
        };
      },
    });

    // register a report listener (SDK2 style not yet operational)
    this.registerReportListener('CENTRAL_SCENE', 'CENTRAL_SCENE_NOTIFICATION', (rawReport, parsedReport) => {
      this.log('registerReportListener', rawReport, parsedReport);
      if (rawReport.hasOwnProperty('Properties1')
				&& rawReport.Properties1.hasOwnProperty('Key Attributes')
				&& rawReport.hasOwnProperty('Scene Number')
				&& rawReport.hasOwnProperty('Sequence Number')) {
        const remoteValue = {
          button: this.buttonMap[rawReport['Scene Number'].toString()].button,
          scene: rawReport.Properties1['Key Attributes'],
        };

        this.log('Triggering sequence:', rawReport['Sequence Number'], 'remoteValue', remoteValue);

        // Trigger the trigger card with 2 autocomplete options
        this.homey.app.triggerZDim_scene.trigger(this, null, remoteValue);
        // Trigger the trigger card with tokens
        this.homey.app.triggerZDim_button.trigger(this, remoteValue, null);
      }
    });

    if (!this.hasCapability('button.reset_meter')) await this.addCapability('button.reset_meter').catch(this.error);
    if (this.hasCapability('button.reset_meter')) {
      // Listen for reset_meter maintenance action
      this.registerCapabilityListener('button.reset_meter', async () => {
      // Maintenance action button was pressed, return a promise
        if (typeof this.meterReset === 'function') return this.meterReset();
        this.error('Reset meter failed');
        throw new Error('Reset meter not supported');
      });
    }

    if (this.hasCapability('meter_power')) this.registerCapability('meter_power', 'METER'); // , { getOpts: { getOnStart: false } });
    if (this.hasCapability('measure_power')) this.registerCapability('measure_power', 'METER'); // , { getOpts: { getOnStart: false } });

    this.setAvailable().catch(this.error);
  }

  onSceneAutocomplete(query, args) {
    let resultArray = [];
    for (const sceneID in this.sceneMap) {
      resultArray.push({
        id: this.sceneMap[sceneID].scene,
        name: this.homey.__(this.sceneMap[sceneID].scene),
      });
    }
    // filter for query
    resultArray = resultArray.filter(result => {
      return result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
    });
    this.log(resultArray);
    return Promise.resolve(resultArray);
  }

};
