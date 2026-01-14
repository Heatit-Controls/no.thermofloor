'use strict';
const Homey = require('homey');
const http = require('node:http');
const util = require('../../lib/util');

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
        let discoveryResults = await this.scanNetwork();
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


    async scanNetwork() {
        const baseIp = util.getBaseIpAddress();
        const out = [];
        const range = Array.from({ length: 254 }, (_, i) => i + 1);

        const scanPromises = range.map(async (i) => {
            const ip = baseIp + i;
            try {
                const isOnline = await util.checkTcpConnection(ip, 80, 2000); 
                if (isOnline) {
                    // this.log(`TCP Port 80 open at: ${ip}`);
                    let data = await this.getWiFi6ThermostatData(ip);
                    if (data.IsWiFi6Thermostat) {
                        // this.log(`SUCCESS: Found WiFi6 Thermostat at ${ip} (Mac: ${data.Mac}, Name: ${data.Name})`);
                        return { "Ip": ip, "Mac": data.Mac, "Name": data.Name };
                    } else {
                        // this.log(`Device at ${ip} is NOT a WiFi6 Thermostat (Data: ${JSON.stringify(data)})`);
                    }
                }
            } catch (e) {
                // Ignore connection errors
            }
            return null;
        });

        const results = await Promise.all(scanPromises);
        return results.filter(device => device !== null);
    }

    async getWiFi6ThermostatData(ip) {
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
                        if (parsedData.parameters.operatingMode != null && parsedData.model == null) {
                            resolve({ "IsWiFi6Thermostat": true, "Mac": parsedData.network.mac, "Name": parsedData.name });
                        } else {
                            resolve({ "IsWiFi6Thermostat": false });
                        }
                    } catch (e) {
                        resolve({ "IsWiFi6Thermostat": false });
                    }
                });

            }).on('error', (e) => {
                // this.log(`HTTP Error for ${ip}: ${e.message}`);
                resolve({ "IsWiFi6Thermostat": false });
            });
        });
    }

};