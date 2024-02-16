'use strict';

const Homey = require('homey');

const { ZwaveDevice } = require('homey-zwavedriver');

class Z_PushButton_8 extends ZwaveDevice {
  async onNodeInit() {
    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    // supported scenes and their reported attribute numbers (all based on reported data)
    this.buttonMap = {
      1: {
        button: 'Group2-I',
      },
      2: {
        button: 'Group2-O',
      },
      3: {
        button: 'Group3-I',
      },
      4: {
        button: 'Group3-O',
      },
      5: {
        button: 'Group4-I',
      },
      6: {
        button: 'Group4-O',
      },
      7: {
        button: 'Group5-I',
      },
      8: {
        button: 'Group5-O',
      },

    };

    this.sceneMap = {
      'Key Pressed 1 time': {
        scene: 'Key Pressed 1 time',
      },
      'Key Held Down': {
        scene: 'Key Held Down',
      },
      'Key Released': {
        scene: 'Key Released',
      },
    };

    // register device capabilities
    this.registerCapability('measure_battery', 'BATTERY');

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
        this.homey.app.triggerZPushButton_scene.trigger(this, null, remoteValue);
        // Trigger the trigger card with tokens
        this.homey.app.triggerZPushButton_button.trigger(this, remoteValue, null);
      }
    });
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

  onButtonAutocomplete(query, args) {
    let resultArray = [];
    for (const sceneID in this.buttonMap) {
      resultArray.push({
        id: this.buttonMap[sceneID].button,
        name: this.homey.__(this.buttonMap[sceneID].button),
      });
    }

    // filter for query
    resultArray = resultArray.filter(result => {
      return result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
    });
    this.log(resultArray);
    return Promise.resolve(resultArray);
  }

}

module.exports = Z_PushButton_8;
