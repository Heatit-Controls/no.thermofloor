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
      this.isDebug = false;
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

      this.refreshStateLoop();
  }

    async loadSettings() {
        if (this.getStore().address != null) {
            await this.setSettings({IPaddress: this.getStore().address,});
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

    ipIsValid() {
        if (this.getStore().address != null) {
            return true
        } else if (util.isValidIpAddress(this.getSettings().IPaddress.trim())) {
            return true
        } else {
            this.setUnavailable('Please check that you have entered a valid IP address in advanced settings and that the device is turned on.').catch(this.error);
            return false
        }
    }

    refreshStateLoop() {

        if (this.deviceIsDeleted) {
            return; //Abort
        }

        if (this.ipIsValid()) {
            this.refreshState()
        }
        setTimeout(() => {
            this.refreshStateLoop()
        }, this.ReportInterval * 1000);
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
                    this.ReconnactionTry = 1;

                    this.setCapabilityValue('dim', parsedData.parameters.dimLevel / 100).catch(this.error);
                    this.setCapabilityValue('onoff', parsedData.parameters.dimmerState).catch(this.error);


                    let kWh = this.getCapabilityValue('meter_power');
                    kWh = kWh + (parsedData.currentPower * (this.getSettings().interval / 3600)) / 1000;
                    this.setCapabilityValue('meter_power', kWh).catch(this.error);
                    this.setCapabilityValue('measure_power', parsedData.currentPower).catch(this.error);
                    if (!this.MACaddressIsValid && this.MACaddress == "GET") {
                        this.setSettings({ MACaddress: parsedData.network.mac }).catch(this.error);
                    }
                    if (!this.deviceIsDeleted) this.setAvailable().catch(this.error);
                } catch (e) {
                    this.log('Cannot connect to API.')
                    this.setCapabilityValue('measure_power', 0).catch(this.error);
                    this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
                    this.debug('Cannot reach device on local WiFi');
                    this.getWiFiDeviceByMac();
                }
            });

        }).on('error', (e) => {
            this.setCapabilityValue('measure_power', 0).catch(this.error);
            this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
            this.debug('Cannot reach device on local WiFi');
            this.getWiFiDeviceByMac();
        });

    }

    getWiFiDeviceByMac() {
        if (this.deviceIsDeleted) {
            return; //exit 
        }

        if (this.MACaddressIsValid && this.ReconnactionTry <= this.MaxReconnactionTrys) {
            this.log("Try:" + this.ReconnactionTry + ". Searching for WM Dimmer by MAC address: " + this.MACaddress);
            (async () => {
                try {
                    this.scanNetwork();
                } catch (error) {

                }
            })();
        }
    }

    async scanNetwork() {
        this.ReconnactionTry++;
        const baseIp = util.getBaseIpAddress(); //'192.168.1.'; Replace with your network's base IP
        const scanPromises = [];
        for (let i = 1; i <= 254; i++) {
            const ip = baseIp + i;
            scanPromises.push(util.scanIp(ip));
        }

        const results = await Promise.all(scanPromises);

        //Filter out and view online devices
        const onlineDevices = results.filter(res => res.status === 'open');

        for (const device of onlineDevices) {
            if (this.deviceIsDeleted) {
                break; //Device deleted, exit loop
            }
            let data = await this.getWmDimmerData(device.ip);
            if (data.IsWmDimmer && data.Mac === this.MACaddress) {
                this.IPaddress = device.ip;
                this.setSettings({ IPaddress: this.IPaddress, }); //await
                this.log('WM Dimmer found by Mac: ' + data.Mac);
                this.ReconnactionTry = 0;
                break; // Found device, exit loop
            }
        }
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

    async getWmDimmerData(ip) {
        this.debug('Check if is WM Dimmer. IP ' + ip);
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
                        if (parsedData.parameters !== null && parsedData.parameters.dimLevel !== null) {
                            this.log('IsWmDimmer true. IP: ' + ip + " Mac: " + parsedData.network.mac);
                            resolve({ "IsWmDimmer": true, "Mac": parsedData.network.mac });
                        } else {
                            resolve({ "IsWmDimmer": false });
                        }
                    } catch (e) {
                        resolve({ "IsWmDimmer": false });
                    }
                });

            }).on('error', (e) => {
                this.log('IsWmDimmer false');
                resolve({ "IsWmDimmer": false });
            });
        });
    }

    /**
 * onAdded is called when the user adds the device, called just after pairing.
 */
    async onAdded() {
        this.log('MyDevice has been added');
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

      this.MACaddress = newSettings.MACaddress.trim().toUpperCase();
      this.MACaddressIsValid = util.isValidMACAddress(this.MACaddress);
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
