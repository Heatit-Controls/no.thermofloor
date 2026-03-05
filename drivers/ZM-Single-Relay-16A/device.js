'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

class ZmSingleRelay16 extends ZwaveDevice {
  async onNodeInit() {
    this.sceneFlowTrigger = this.driver.sceneFlowTrigger;
    if (this.getClass() !== 'socket') {
      await this.setClass('socket').catch(this.error)
    }
    this.registerCapability('onoff', 'SWITCH_BINARY');
    this.registerCapability('measure_power', 'METER');
    this.registerCapability('meter_power', 'METER');

    this.registerReportListener('CENTRAL_SCENE', 'CENTRAL_SCENE_NOTIFICATION', report => {
      if (report['Properties1']
        && report.Properties1['Key Attributes']
        && report['Scene Number']) {
        const data = {
          button: report['Scene Number'].toString(),
          scene: report.Properties1['Key Attributes'],
        };

        // this.log('Triggering sequence:', report['Sequence Number'], 'data', data);
        this.sceneFlowTrigger.trigger(this, null, data);
      }
    });

    if (this.hasCapability('meter_power')) this.registerCapability('meter_power', 'METER');
    if (this.hasCapability('measure_power')) this.registerCapability('measure_power', 'METER');

    if (this.hasCapability('button.reset_meter') === false) {
      await this.addCapability('button.reset_meter');
    }

    this.setAvailable().catch(this.error);

    // Register capability listener for reset meter button
    this.registerCapabilityListener('button.reset_meter', async () => {
      let commandClassMeter = this.getCommandClass('METER');
      if (commandClassMeter && commandClassMeter.hasOwnProperty('METER_RESET')) {
        const result = await commandClassMeter.METER_RESET({});
        if (result !== 'TRANSMIT_COMPLETE_OK') throw result;
      } else {
        throw new Error('Reset meter not supported');
      }
    });
  }

  sceneRunListener(args, state) {
    return (state
      && state.hasOwnProperty('button')
      && state.hasOwnProperty('scene')
      && args.hasOwnProperty('button')
      && args.hasOwnProperty('scene')
      && state.button === args.button
      && state.scene === args.scene);
  }
}

module.exports = ZmSingleRelay16;
