'use strict';
const Homey = require('homey');
const http = require('node:http');

module.exports = class MyDevice extends Homey.Device {

    async onInit() {

        this.log('Device has been initialized');
        this.registerCapabilityListener('target_temperature', async (value) => {
            this.log("Changed temp", value);
            this.heatingSetpoint(value);
        });

        this.registerCapabilityListener('onoff', async (value) => {
            this.log("Changed On/Off", value);
            if (value) {
                this.panelModeOn();
            } else {
                this.panelModeOff();
            }
        });

        this.setCapabilityValue('measure_power', 0).catch(this.error);
        this.setAvailable();

        setInterval(() => {
            this.refreshState();
        }, this.getSettings().interval * 1000);

    }

    async refreshState() {

        const client = http.get({
            hostname: this.IPaddress,
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
                    this.setCapabilityValue('measure_temperature', parsedData.roomTemperature).catch(this.error);
                    this.setCapabilityValue('target_temperature', parsedData.parameters.heatingSetpoint).catch(this.error);
                    let kWh = this.getCapabilityValue('meter_power');
                    kWh = kWh + (parsedData.currentPower * (this.getSettings().interval / 3600)) / 1000;
                    this.setCapabilityValue('meter_power', kWh).catch(this.error);
                    this.setCapabilityValue('measure_power', parsedData.currentPower).catch(this.error);
                    this.setAvailable();
                } catch (e) {
                }
            });

        }).on('error', (e) => {
            this.setCapabilityValue('measure_power', 0).catch(this.error);
            this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
            this.log('Cannot reach device on local WiFi');
        });

    }

    async panelModeOn() {
        const postData = JSON.stringify({
            'panelMode': 1,
        });
        await this.setParameters(postData);
    }

    async panelModeOff() {
        const postData = JSON.stringify({
            'panelMode': 0,
        });
        await this.setParameters(postData);
    }

    async heatingSetpoint(value) {
        const postData = JSON.stringify({
            'heatingSetpoint': value,
        });
        await this.setParameters(postData);
    }

    async setParameters(postData) {
        this.log('setParameters');

        const options = {
            hostname: this.IPaddress,
            port: 80,
            path: '/api/parameters',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = http.request(options, (res) => {
            this.log(`STATUS: ${res.statusCode}`);
            this.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                this.log(`BODY: ${chunk}`);
            });
            res.on('end', () => {
            });
        });

        req.on('error', (e) => {
            this.log(`problem with request: ${e.message}`);
        });

        req.write(postData);
        req.end();
    }

    async onAdded() {
        this.log('My heatit WiFi device has been added');
    }

    async onSettings({
        oldSettings,
        newSettings,
        changedKeys,
    }) {
        this.log("My heatit WiFi device settings where changed");
    }

    async onRenamed(name) {
        this.log('My heatit WiFi device was renamed');
    }

    async onDeleted() {
        this.log('My heatit WiFi device has been deleted');
    }

};