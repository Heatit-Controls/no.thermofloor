'use strict';
const Homey = require('homey');
const http = require('node:http');
const util = require('../../lib/util');

module.exports = class MyDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('WM Dimmer has been initialized');
      this.isDebug = true;
      this.deviceIsDeleted = false;

      this.registerCapabilityListener('onoff', async (value) => {
          this.debug("Changed On/Off", value);
          if (value) {
              this.setDimmerOn();
          } else {
              this.setDimmerOff();
          }
      });

      this.registerCapabilityListener('dim', async (value) => {
          this.debug("Changed dim level", value);
          if (value) {
              this.setDimLevel(value);
          }
      });

      await this.loadSettings();
  }

    async loadSettings() {
        if (this.getStore().address != null) {

            if (!util.isValidIpAddress(this.getSettings().IPaddress.trim())) {
                await this.setSettings({
                    IPaddress: this.getStore().address,
                });
            }

            this.IPaddress = this.getStore().address;
        } else {
            this.IPaddress = this.getSettings().IPaddress.trim();
        }
        this.MaxReconnactionTrys = 5;
        this.ReconnactionTry = 1;
        this.MACaddress = this.getSettings().MACaddress.trim().toUpperCase();
        this.MACaddressIsValid = util.isValidMACAddress(this.MACaddress);
        this.ReportInterval = this.getSettings().interval;
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
  }

    debug(msg) {
        if (this.isDebug) {
            this.log(msg);
        }
    }

    async setDimLevel(value) {
        const dimLevel = Math.round(value * 100); /* 0.0 - 1.0 Homey value to 0 - 100*/
        const postData = JSON.stringify({
            'dimLevel': dimLevel,
        });
        await this.setParameters(postData);
    }

    async setDimmerOn() {
        const postData = JSON.stringify({
            'dimmerState': 1,
        });
        await this.setParameters(postData);
    }

    async setDimmerOff() {
        const postData = JSON.stringify({
            'dimmerState': 0,
        });
        await this.setParameters(postData);
    }

    async setParameters(postData) {
        this.debug('setParameters');

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
            this.debug(`STATUS: ${res.statusCode}`);
            this.debug(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                this.debug(`BODY: ${chunk}`);
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

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
      this.log("My heatit WM Dimmer device settings where changed");

      if (!util.isValidIpAddress(newSettings.IPaddress)) {
          throw new Error('Invalid IP address!')
      }

      this.IPaddress = newSettings.IPaddress;
      this.ReportInterval = newSettings.interval;
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('MyDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');
  }

};
