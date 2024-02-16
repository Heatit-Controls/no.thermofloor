'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

class Dimmer extends ZigBeeDevice {

  /**
   * onInit is called when the device is initialized.
   */
  async onNodeInit(zclNode) {

    this.log('Dimmer has been initialized');
	
    // Register onoff capability
    this.registerCapability('onoff', CLUSTER.ON_OFF);

    // Register dim capability
    this.registerCapability('dim', CLUSTER.LEVEL_CONTROL);
  }

  onEndDeviceAnnounce() {
    this.log('device came online!');
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Dimmer has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Dimmer settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('Dimmer was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('Dimmer has been deleted');
  }
}

module.exports = Dimmer;
