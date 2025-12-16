'use strict';
const Homey = require('homey');
const http = require('node:http');
const util = require('../../lib/util');

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


        let discoveryResults = await this.scanNetwork();
        let compatibleDevices = [];

        for (const item of discoveryResults) {
            compatibleDevices.push(
                {
                    name: "WiFi-Panel IP " + item.Ip,
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

    async scanNetwork() {
        const baseIp = util.getBaseIpAddress(); //'192.168.1.'; Replace with your network's base IP this.
        const out = [];
        for (let i = 1; i <= 254; i++) {
            const ip = baseIp + i;
            const isOnline = await util.checkTcpConnection(ip, 80); // Check port 80
            if (isOnline) {
                this.log(`Device found at: ${ip}`);
                let data = await this.isWiFiPanelHeater(ip);
                if (data.isWiFiPanelHeater) {
                    out.push({ "Ip": ip, "Mac": data.Mac });
                    this.log('Yes is WiFi-Panel. Mac: ' + data.Mac)
                }
            }
        }
        return out;
    }

    async isWiFiPanelHeater(ip) {
        this.log('isWiFiPanelHeater IP ' + ip);

        return new Promise((resolve) => {
            http.get({
                hostname: ip, //'192.168.1.71'
                port: 80,
                path: '/api/status',
                agent: false,  // Create a new agent just for this one request
            }, (res) => {

                const { statusCode } = res;
                const contentType = res.headers['content-type'];

                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(rawData);
                        if (parsedData.parameters.panelMode != null) {
                            this.log('isWiFiPanelHeater true');
                            resolve({ "isWiFiPanelHeater": true, "Mac": parsedData.network.mac });
                        } else {
                            resolve({ "isWiFiPanelHeater": false });
                        }
                    } catch (e) {
                        resolve({ "isWiFiPanelHeater": false });
                    }
                });

            }).on('error', (e) => {
                this.log('isWiFiPanelHeater false');
                resolve({"isWiFiPanelHeater": false});
            });
        });
    }
}