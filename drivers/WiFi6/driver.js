'use strict';
const Homey = require('homey');
const http = require('node:http');

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

        let discoveryStrategy = this.homey.discovery.getStrategy("arp");
        let discoveryResults = discoveryStrategy.getDiscoveryResults();

        let allDevices = Object.values(discoveryResults).map(discoveryResult => {
            return {
                name: discoveryResult.address,
                data: {
                    id: discoveryResult.id,
                },
                store: {
                    address: discoveryResult.address
                },
            };
        });

        let compatibleDevices = allDevices;

        for (const element of allDevices) {
            if (await this.isNotWiFiThermostat(element.store.address)) {
                compatibleDevices = compatibleDevices.filter(obj => obj.store.address !== element.store.address); //Remove
            }
        }

        if (compatibleDevices.length == 0) {
            return [
                {
                    name: "Add manually",
                    data: {
                        id: "WiFi-Thermostat" + Math.floor(Math.random() * 1000000000000),
                    },
                },
            ];
        }else {
            return compatibleDevices;
        }
    }


    async isNotWiFiThermostat(ip) {

        this.log('isNotWiFiThermostat IP ' + ip);

        return new Promise((resolve) => {

            http.get({
                hostname: ip,
                port: 80,
                path: '/api/status',
                agent: false,
            }, (res) => {

                const { statusCode } = res;
                const contentType = res.headers['content-type'];

                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(rawData);
                        if (parsedData.parameters.operatingMode != null) {
                            this.log('isWiFiThermostat true');
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    } catch (e) {
                        resolve(true);
                    }
                });

            }).on('error', (e) => {
                this.log('isWiFiThermostat false');
                resolve(true);
            });
        });
    }

};