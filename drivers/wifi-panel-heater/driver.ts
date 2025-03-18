import Homey from 'homey';
import http from 'node:http';

module.exports = class MyDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.log('Diver has been initialized');
        //this.log(this.homey.arp)
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
            if (await this.isNotWiFiPanelHeater(element.store.address)) {
                compatibleDevices = compatibleDevices.filter(obj => obj.store.address !== element.store.address) //Remove
            }
        }


        return compatibleDevices;


        return [
            // Example device data, note that `store` is optional
            {
                name: 'Panel Heater',
                data: {
                    id: 'my-device1',
                },
                store: {
                    address: '127.0.0.1',
                },
            },
        ];
    }

    async isNotWiFiPanelHeater(ip: string) {

        this.log('isWiFiPanelHeater IP ' + ip)

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
                            this.log('isWiFiPanelHeater true')
                            resolve(false)
                        } else {
                            resolve(true)
                        }
                    } catch (e) {
                        //this.log(e.message);
                        resolve(true)
                    }
                });

            }).on('error', (e) => {
                this.log('isWiFiPanelHeater false')
                resolve(true)
            });
        })
    }

    
}
