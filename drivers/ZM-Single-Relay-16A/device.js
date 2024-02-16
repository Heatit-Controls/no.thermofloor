'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

class ZmSingleRelay16 extends ZwaveDevice {
  onNodeInit() {
    this.sceneFlowTrigger = this.driver.sceneFlowTrigger;

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
