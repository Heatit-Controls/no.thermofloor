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
                    name: "WiFi7 IP " + item.Ip,
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

    async scanNetwork() {
        const baseIp = util.getBaseIpAddress(); //'192.168.1.'; Replace with your network's base IP this.
        const out = [];
        for (let i = 1; i <= 254; i++) {
            const ip = baseIp + i;
            const isOnline = await util.checkTcpConnection(ip, 80); // Check port 80
            if (isOnline) {
                //this.log(`Device found at: ${ip}`);
                let data = await this.getWiFi7ThermostatData(ip);
                if (data.IsWiFi7Thermostat) {
                    out.push({ "Ip": ip, "Mac": data.Mac });
                    this.log('Yes is WiFi7 Thermostat. IP: ' + ip +' Mac: ' + data.Mac)
                }
            }
        }
        return out;
    }

    async getWiFi7ThermostatData(ip) {
        //this.log('isNotWiFiThermostat IP ' + ip);
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
                        if (parsedData.model === "Heatit WiFi7") {
                            this.log('IsWiFi7Thermostat true');
                            resolve({"IsWiFi7Thermostat": true, "Mac": parsedData.network.mac });
                        } else {
                            resolve({"IsWiFi7Thermostat": false});
                        }
                    } catch (e) {
                        resolve({"IsWiFi7Thermostat": false});
                    }
                });

            }).on('error', (e) => {
                this.log('isWiFiThermostat false');
                resolve({"IsWiFi7Thermostat": false});
            });
        });
    }

};