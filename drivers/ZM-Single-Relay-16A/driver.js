'use strict';

const Homey = require('homey');

class ZmSingleRelay16Driver extends Homey.Driver {
  onInit() {
    super.onInit();

    this.sceneFlowTrigger = this.homey.flow.getDeviceTriggerCard('zm-relay16-scene');
    this.sceneFlowTrigger.registerRunListener((args, state) => {
      return args.device.sceneRunListener(args, state);
    });
  }
}

module.exports = ZmSingleRelay16Driver;