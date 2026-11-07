// Connection to the Kettler console over USB serial: finds the CP2102 adapter, polls ST
// once per second and reconnects when the console is unplugged or switched off.

const { EventEmitter } = require('node:events');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { parseStatus } = require('./parse');

const VENDOR_ID = '10c4'; // Silicon Labs CP210x
const PRODUCT_ID = 'ea60';
const SCAN_MS = 5000;
const POLL_MS = 1000;
const WRITE_GAP_MS = 100; // the console takes one command per 100 ms

// Start sequence from kettlerUSB2BLE: identify, reset, command mode, program 1.
const START = ['VE', 'ID', 'VE', 'KI', 'CA', 'RS', 'CM', 'SP1'];

class KettlerConsole extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this.queue = [];
    this.timers = [];
  }

  start() {
    this.scan();
  }

  async scan() {
    if (this.port) return;
    try {
      const ports = await SerialPort.list();
      const match = ports.find((p) => (p.vendorId ?? '').toLowerCase() === VENDOR_ID
        && (p.productId ?? '').toLowerCase() === PRODUCT_ID);
      if (match) {
        this.open(match.path);
        return;
      }
    } catch (error) {
      this.emit('error', error);
    }
    setTimeout(() => this.scan(), SCAN_MS);
  }

  open(path) {
    const port = new SerialPort({ path, baudRate: 9600, autoOpen: false });
    port.open((error) => {
      if (error) {
        this.emit('error', error);
        setTimeout(() => this.scan(), SCAN_MS);
        return;
      }
      this.port = port;
      port.pipe(new ReadlineParser({ delimiter: '\r\n' })).on('data', (line) => this.onLine(line));
      port.on('error', (err) => this.emit('error', err));
      port.on('close', () => this.onClose());
      for (const command of START) this.write(command);
      this.timers = [
        setInterval(() => this.flush(), WRITE_GAP_MS),
        setInterval(() => this.write('ST'), POLL_MS),
      ];
      this.emit('open', path);
    });
  }

  onLine(line) {
    const data = parseStatus(line);
    if (data) this.emit('data', data);
    else this.emit('line', line);
  }

  onClose() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    this.queue = [];
    this.port = null;
    this.emit('close');
    setTimeout(() => this.scan(), SCAN_MS);
  }

  write(command) {
    if (command === 'ST' && this.queue.includes('ST')) return; // don't pile up polls
    this.queue.push(command);
  }

  flush() {
    const command = this.queue.shift();
    if (command && this.port) this.port.write(`${command}\r\n`);
  }

  setPower(watt) {
    this.write(`PW${Math.round(watt)}`);
  }

  reset() {
    this.write('RS');
    this.write('CM');
  }
}

module.exports = { KettlerConsole };
