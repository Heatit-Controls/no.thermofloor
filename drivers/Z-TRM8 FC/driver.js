'use strict';

const Homey = require('homey');

class ZTRM8FCDriver extends Homey.Driver {
	onInit() {
		super.onInit();

		this.sceneFlowTrigger = this.homey.flow.getDeviceTriggerCard('ztrm8fc-scene');
		this.sceneFlowTrigger.registerRunListener((args, state) => {
			return args.device.sceneRunListener(args, state);
		});
	}
}

module.exports = ZTRM8FCDriver;
