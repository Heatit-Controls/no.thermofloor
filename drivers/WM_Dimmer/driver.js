'use strict';
const Homey = require('homey');
const http = require('node:http');
const util = require('../../lib/util');
const { discoverDevices } = require('../../lib/util/discovery');

module.exports = class MyDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
    async onPairListDevices() {
        const discoveryResults = await discoverDevices({
            driverName: 'WiFi Dimmer',
            isModelMatch: (data) => {
                const isDimmer = data.parameters && data.parameters.dimLevel !== undefined;
                /*const isCorrectModel = !data.model || data.model === "Heatit WiFi Panel" || data.model === "Heatit WiFi Panel Heater";*/
                return isDimmer; /* && isCorrectModel*/
            },
            log: this.log.bind(this),
        });

        let compatibleDevices = [];

        for (const item of discoveryResults) {
            compatibleDevices.push(
                {
                    name: "WM Dimmer " + (item.Name || item.Ip),
                    data: {
                        id: "WM Dimmer" + item.Mac,
                    },
                    store: {
                        address: item.Ip
                    }
                }
            );
        }

        compatibleDevices.push(
            {
                name: "Add manually",
                data: {
                    id: "WM Dimmer" + Math.floor(Math.random() * 1000000000000),
                },
            }
        );

        return compatibleDevices;
    }

};
