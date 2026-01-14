'use strict';
const Homey = require('homey');
const http = require('node:http');
const util = require('../../lib/util');
const { discoverThermostats } = require('../../lib/util/discovery');

module.exports = class MyDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.log('Driver has been initialized');
    }

    /**
     * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
     * This should return an array with the data of devices that are available for pairing.
     */
    async onPairListDevices() {
        const discoveryResults = await discoverThermostats({
            driverName: 'WiFi6',
            isModelMatch: (data) => data.parameters && data.parameters.operatingMode != null && data.model == null,
            log: this.log.bind(this),
        });

        let compatibleDevices = [];

        for (const item of discoveryResults) {
            compatibleDevices.push(
                {
                    name: "WiFi6 " + (item.Name || item.Ip),
                    data: {
                        id: "WiFi6-Thermostat" + item.Mac,
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
                    id: "WiFi6-Thermostat" + Math.floor(Math.random() * 1000000000000),
                },
            }
        );

        return compatibleDevices;
    }

};