'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

class ZPushWallController extends ZwaveDevice {
  onNodeInit() {
    this.sceneFlowTrigger = this.driver.sceneFlowTrigger;

    // getOnOnline workaround to disable automatic battery polling on each Wake Up so that Homey Z-Wave S0 engine could setup Associations properly
    this.registerCapability('measure_battery', 'BATTERY', {"getOpts": {"getOnOnline":false}});

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

module.exports = ZPushWallController;
