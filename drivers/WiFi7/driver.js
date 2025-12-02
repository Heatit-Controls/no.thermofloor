'use strict';
const Homey = require('homey');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');

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
                    name: "WiFi7 IP" + item.Ip,
                    data: {
                        id: "WiFi7-Thermostat" + item.Mac,
                    },
                    store: {
                        address: item.Ip
                    }
                }
            );
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
        }
        else {
            return compatibleDevices;
        }
    }

    async scanNetwork() {
        const baseIp = this.getBaseIpAddress(); //'192.168.1.'; Replace with your network's base IP
        const out = [];
        for (let i = 1; i <= 254; i++) {
            const ip = baseIp + i;
            const isOnline = await this.checkTcpConnection(ip, 80); // Check port 80
            if (isOnline) {
                this.log(`Device found at: ${ip}`);
                let data = await this.getWiFiThermostatData(ip);
                if (data.IsWiFi7Thermostat) {
                    out.push({ "Ip": ip, "Mac": data.Mac });
                    this.log('Yes is WiFi7 Thermostat. Mac: ' + data.Mac)
                }
            }
        }
        return out;
    }

    async checkTcpConnection(hostname, port = 80, timeout = 80) {
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

    async getWiFiThermostatData(ip) {

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

    getBaseIpAddress() {
        const networkInterfaces = os.networkInterfaces();
        let localIp = '192.168.1.1';

        for (const devName in networkInterfaces) {
            const iface = networkInterfaces[devName];
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    localIp = alias.address; 
                    break; // Found a suitable IPv4 address, exit inner loop
                }
            }
            if (localIp !== '192.168.1.1') {
                break; // Found a suitable IPv4 address, exit outer loop
            }
        }

        const octets = localIp.split('.');

        if (octets.length === 4) {
            return octets[0] + '.' + octets[1] + '.' + octets[2] + '.';
        } else {
            return '192.168.1.';
        }

        
    }
};