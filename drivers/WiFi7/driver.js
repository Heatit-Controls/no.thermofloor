'use strict';
const Homey = require('homey');
const { discoverDevices } = require('../../lib/util/discovery');

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
        const discoveryResults = await discoverDevices({
            driverName: 'WiFi7',
            isModelMatch: (data) => data.model === "Heatit WiFi7",
            log: this.log.bind(this),
        });

        let compatibleDevices = [];

        for (const item of discoveryResults) {
            compatibleDevices.push(
                {
                    name: "WiFi7 " + (item.Name || item.Ip),
                    data: {
                        id: "WiFi7-Thermostat" + item.Mac,
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
                    id: "WiFi7-Thermostat" + Math.floor(Math.random() * 1000000000000),
                },
            }
        );

        return compatibleDevices;
    }

};