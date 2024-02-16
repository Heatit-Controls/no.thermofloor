'use strict';

const Homey = require('homey');

class ZPushWallControllerDriver extends Homey.Driver {
  async onInit() {
    super.onInit();

    this.sceneFlowTrigger = this.homey.flow.getDeviceTriggerCard('z-push-wc-scene');
    this.sceneFlowTrigger.registerRunListener((args, state) => {
      return args.device.sceneRunListener(args, state);
    });
  }
}

module.exports = ZPushWallControllerDriver;