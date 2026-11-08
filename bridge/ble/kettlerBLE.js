const bleno = require('@abandonware/bleno');
const EventEmitter = require('events');
const CyclingPowerService = require('./cycling-power-service');
const FitnessMachineService = require('./ftms-service');
const CyclingSpeedService = require('./csc-service'); // StrideCast

// StrideCast: advertising data with flags, the 16-bit service UUIDs and the complete name.
function advertisement(name, uuids) {
	const flags = Buffer.from([0x02, 0x01, 0x06]); // LE general discoverable, no BR/EDR
	const list = Buffer.alloc(2 + 2 * uuids.length);
	list.writeUInt8(1 + 2 * uuids.length, 0);
	list.writeUInt8(0x03, 1); // complete list of 16-bit service UUIDs
	uuids.forEach((uuid, i) => list.writeUInt16LE(parseInt(uuid, 16), 2 + 2 * i));
	const nameBytes = Buffer.from(name, 'utf8');
	const nameField = Buffer.concat([Buffer.from([1 + nameBytes.length, 0x09]), nameBytes]);
	const data = Buffer.concat([flags, list, nameField]);
	if (data.length > 31) throw new Error(`advertising data is ${data.length} bytes, at most 31 fit`);
	return data;
}

class KettlerBLE extends EventEmitter {

	constructor(serverCallback) {
		super();

		this.name = "StrideCast";
		process.env['BLENO_DEVICE_NAME'] = this.name; 

		this.csp = new CyclingPowerService();
		this.ftms = new FitnessMachineService(serverCallback); 
		this.csc = new CyclingSpeedService(); // StrideCast: speed for watches

		let self = this;
		console.log(`[${this.name} starting]`);

		bleno.on('stateChange', (state) => {
			console.log(`[${this.name} stateChange] new state: ${state}`);
			
			self.emit('stateChange', state);

			if (state === 'poweredOn') {
				// StrideCast: the name goes in the advertisement itself, not only in the scan
				// response, so watches that scan passively show "StrideCast" instead of an address.
				bleno.startAdvertisingWithEIRData(advertisement(self.name, ['1818', '1826', '1816']));
			} else {
				console.log('Stopping...');
				bleno.stopAdvertising();
			}
		});

		bleno.on('advertisingStart', (error) => {
			console.log(`[${this.name} advertisingStart] ${(error ? 'error ' + error : 'success')}`);
			self.emit('advertisingStart', error);

			if (!error) {
				bleno.setServices([self.csp
				, self.ftms
				, self.csc
				], 
				(error) => {
					console.log(`[${this.name} setServices] ${(error ? 'error ' + error : 'success')}`);
				});
			}
		});

		bleno.on('advertisingStartError', () => {
			console.log(`[${this.name} advertisingStartError] advertising stopped`);
			self.emit('advertisingStartError');
		});

		bleno.on('advertisingStop', error => {
			console.log(`[${this.name} advertisingStop] ${(error ? 'error ' + error : 'success')}`);
			self.emit('advertisingStop');
		});

		bleno.on('servicesSet', error => {
			console.log(`[${this.name} servicesSet] ${ (error) ? 'error ' + error : 'success'}`);
		});

		bleno.on('accept', (clientAddress) => {
			console.log(`[${this.name} accept] Client: ${clientAddress}`);
			self.emit('accept', clientAddress);
			bleno.updateRssi();
		});

		bleno.on('rssiUpdate', (rssi) => {
			console.log(`[${this.name} rssiUpdate]: ${rssi}`);
		});

	}

	// notifiy BLE services
	notifyFTMS(event) {
		this.csp.notify(event);
		this.ftms.notify(event);
		this.csc.notify(event);
	};
	
 

};

module.exports = KettlerBLE;
module.exports.advertisement = advertisement;