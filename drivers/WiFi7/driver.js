'use strict';
const Homey = require('homey');
const http = require('node:http');
const net = require('node:net')

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

        let list = await this.scanNetwork();
        list.forEach(device => {
            this.log("Opp" + device);
        });

        if (compatibleDevices.length == 0) {
            return [
                {
                    name: "Add manually",
                    data: {
                        id: "WiFi-Thermostat" + Math.floor(Math.random() * 1000000000000),
                    },
                },
            ];
        }
        else {
            return compatibleDevices;
        }
    }

    async scanNetwork() {
        const baseIp = '192.168.1.'; // Replace with your network's base IP
        const out = [];
        for (let i = 1; i <= 254; i++) {
            const ip = baseIp + i;
            const isOnline = await this.checkTcpConnection(ip, 80); // Check port 80
            if (isOnline) {
                this.log(`Device found at: ${ip}`);
                if (this.isWiFiThermostat(ip)) {
                    out.push(ip);
                    this.log('Yes is WiFi Thermostat')
                }
            }
        }
        return out;
    }

    checkTcpConnection(hostname, port = 80, timeout = 50) {
        return new Promise((resolve) => {
            const socket = net.createConnection(port, hostname);
            socket.setTimeout(timeout);

            socket.on('connect', () => {
                socket.end();
                resolve(true); // Device is likely online
            });

            function handleError() {
                socket.destroy();
                resolve(false); // Device is offline or port is closed
            }
            socket.on('timeout', handleError);
            socket.on('error', handleError);
        });
    }

    async isNotWiFiThermostat(ip) {
        return await !this.isWiFiThermostat(ip);
    }

    async isWiFiThermostat(ip) {

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
                        if (parsedData.model === "Heatit WiFi7") {
                            this.log('IsWiFi7Thermostat true');
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch (e) {
                        resolve(false);
                    }
                });

            }).on('error', (e) => {
                this.log('isWiFiThermostat false');
                resolve(false);
            });
        });
    }
};