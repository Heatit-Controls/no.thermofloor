import Homey from 'homey';
import http from 'node:http';

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
              this.panelModeOn()
          } else {
              this.panelModeOff()
          }
      });

      this.setCapabilityValue('measure_power', 0).catch(this.error)
      this.setAvailable();

      //this.log(settings.interval);
      //this.log(this.getData().id + this.getStore().address);

      setInterval(() => {
          this.refreshState()
      }, this.getSettings().interval * 1000);

   }


   async refreshState() {

        //this.log('refreshState')

        const client = http.get({
            hostname: this.getStore().address, //'192.168.1.71'
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
                     this.setCapabilityValue('measure_temperature', parsedData.roomTemperature).catch(this.error)
                     this.setCapabilityValue('target_temperature', parsedData.parameters.heatingSetpoint).catch(this.error)
                     let kWh = this.getCapabilityValue('meter_power')
                     kWh = kWh + (parsedData.currentPower * (this.getSettings().interval / 3600)) / 1000
                     this.setCapabilityValue('meter_power', kWh).catch(this.error)
                     this.setCapabilityValue('measure_power', parsedData.currentPower).catch(this.error)
                     this.setAvailable();
                } catch (e) {
                    //this.log(e.message);
                }
            });

        }).on('error', (e) => {
            this.setCapabilityValue('measure_power', 0).catch(this.error)
            this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
            this.log('Cannot reach device on local WiFi')
        });

   }

    async panelModeOn() {
        const postData = JSON.stringify({
            'panelMode': 1,
        });
        await this.setParameters(postData)
    }

    async panelModeOff() {
        const postData = JSON.stringify({
            'panelMode': 0,
        });
        await this.setParameters(postData)
    }

    async heatingSetpoint(value: string) {
        const postData = JSON.stringify({
            'heatingSetpoint': value,
        });
        await this.setParameters(postData)
    }

    async setParameters(postData: string) {
        this.log('setParameters')

        const options = {
            hostname: this.getStore().address, //'192.168.1.71'
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
                //this.log('No more data in response.');
            });
        });

        req.on('error', (e) => {
            this.log(`problem with request: ${e.message}`);
        });

        // Write data to request body
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
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
      this.log("My heatit WiFi device settings where changed");
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
      this.log('My heatit WiFi device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
      this.log('My heatit WiFi device has been deleted');
  }

};