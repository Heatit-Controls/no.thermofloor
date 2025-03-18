'use strict';
const Homey = require('homey');
const http = require('node:http');

module.exports = class MyDevice extends Homey.Device {

    /**
     * onInit is called when the device is initialized.
     */
    async onInit() {
        this.log('Device has been initialized');
        this.registerCapabilityListener('target_temperature', async (value) => {
            this.log("Changed temp", value);
            this.heatingSetpoint(value);
        });


        this.registerCapabilityListener('onoff', async (value) => {
            this.log("Changed On/Off", value);
            if (value) {
                this.operatingModeOn()
            } else {
                this.operatingModeOff()
            }
        });

        this.setCapabilityValue('measure_power', 0).catch(this.error);
        this.setAvailable();

        setInterval(() => {
            this.refreshState()
        }, this.getSettings().interval * 1000);
    }

    async refreshState() {
        const client = http.get({
            hostname: this.getStore().address,
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
                    this.setCapabilityValue('measure_temperature', parsedData.internalTemperature).catch(this.error);
                    this.setCapabilityValue('target_temperature', parsedData.parameters.heatingSetpoint).catch(this.error);
                    let kWh = this.getCapabilityValue('meter_power');
                    kWh = kWh + (parsedData.currentPower * (this.getSettings().interval / 3600)) / 1000;
                    this.setCapabilityValue('meter_power', kWh).catch(this.error);
                    this.setCapabilityValue('measure_power', parsedData.currentPower).catch(this.error);
                    this.setAvailable();
                } catch (e) {
                    // Handle error
                }
            });

        }).on('error', (e) => {
            this.setCapabilityValue('measure_power', 0).catch(this.error);
            this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
            this.log('Cannot reach device on local WiFi');
        });
    }

    async operatingModeOn() {
        const postData = JSON.stringify({
            'operatingMode': 1,
        });
        await this.setParameters(postData);
    }

    async operatingModeOff() {
        const postData = JSON.stringify({
            'operatingMode': 0,
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
            hostname: this.getStore().address,
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
                // Handle end
            });
        });

        req.on('error', (e) => {
            this.log(`problem with request: ${e.message}`);
        });

        req.write(postData);
        req.end();
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded() {
        this.log('My heatit WiFi device has been added');
    }

    /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
    async onSettings({
        oldSettings,
        newSettings,
        changedKeys,
    }) {
        this.log("My heatit WiFi device settings where changed");
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * @param {string} name The new name
     */
    async onRenamed(name) {
        this.log('My heatit WiFi device was renamed');
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onDeleted() {
        this.log('My heatit WiFi device has been deleted');
    }
};