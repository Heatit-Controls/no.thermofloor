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
        this.log('Diver has been initialized');
    }

    /**
     * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
     * This should return an array with the data of devices that are available for pairing.
     */
    async onPairListDevices() {
        const discoveryResults = await discoverDevices({
            driverName: 'WiFi Panel',
            isModelMatch: (data) => {
                const isPanel = data.parameters && data.parameters.panelMode !== undefined;
                const isCorrectModel = !data.model || data.model === "Heatit WiFi Panel" || data.model === "Heatit WiFi Panel Heater";
                return isPanel && isCorrectModel;
            },
            log: this.log.bind(this),
        });

        let compatibleDevices = [];

        for (const item of discoveryResults) {
            compatibleDevices.push(
                {
                    name: "WiFi Panel " + (item.Name || item.Ip),
                    data: {
                        id: "WiFi-Panel" + item.Mac,
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
                    id: "WiFi-Panel" + Math.floor(Math.random() * 1000000000000),
                },
            }
        );

        return compatibleDevices;
    }

};