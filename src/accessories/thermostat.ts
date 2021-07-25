/* eslint-disable @typescript-eslint/ban-ts-comment */
import {PlatformAccessory, Service} from 'homebridge';
import {ExampleHomebridgePlatform} from '../platform';
import {objectStringParser} from '../bacnet/parser';
import {readBACNetValue, writeBACNetValue} from '../bacnet/bacnet';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class BachomeThermostatAccessory {
  private service: Service;

  private internalStates = {
    currentHeatingState: -1,
    currentCoolingState: -1,
    currentHeatingCoolingState: -1,
    targetHeatingCoolingState: -1,
    currentTemperature: -1,
    targetTemperature: -1,
    temperatureDisplayUnits: 0,
  }

  private stateObjects = {
    currentHeatingState: {},
    currentCoolingState: {},
    targetHeatingCoolingState: {},
    currentTemperature: {},
    targetTemperature: {},
  }

  private readonly ipAddress = '';
  private readonly net = -1;
  private readonly adr = -1;

  private mapStates;
  private reverseMapStates;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.manufacturer)
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.serial);

    this.service = this.accessory.getService(this.platform.Service.Thermostat)
      || this.accessory.addService(this.platform.Service.Thermostat);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE');

    // Read the service name form the accessory context (config file passed via platform)
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.stateObjects['currentHeatingState'] = objectStringParser(accessory.context.device.currentHeatingState);
    this.stateObjects['currentCoolingState'] = objectStringParser(accessory.context.device.currentCoolingState);
    this.stateObjects['targetHeatingCoolingState'] = objectStringParser(accessory.context.device.targetHeatingCoolingState);
    this.stateObjects['currentTemperature'] = objectStringParser(accessory.context.device.currentTemperature);
    this.stateObjects['targetTemperature'] = objectStringParser(accessory.context.device.targetTemperature);

    this.ipAddress = accessory.context.device.ipAddress;
    this.net = accessory.context.device.net;
    this.adr = accessory.context.device.adr;

    // register handlers for mandatory characteristics
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .on('set', this.setTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .on('set', this.setTargetTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .on('set', this.setTemperatureDisplayUnits.bind(this))
      .on('get', this.getTemperatureDisplayUnits.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: this.accessory.context.device.minTemp,
        maxValue: this.accessory.context.device.maxTemp,
        minStep: this.accessory.context.device.maxStep
      });

    this.poll(this.updateCurrentHeatingCoolingState.bind(this), this.accessory.context.device.pollFrequency * 1000);
    this.poll(this.updateTargetHeatingCoolingState.bind(this), this.accessory.context.device.pollFrequency * 1000);
    this.poll(this.updateCurrentTemperature.bind(this), this.accessory.context.device.pollFrequency * 1000);
    this.poll(this.updateTargetTemperature.bind(this), this.accessory.context.device.pollFrequency * 1000);

    this.mapStates = new Map([
        [ this.accessory.context.device.targetHeatOnlyStateValue, this.platform.Characteristic.TargetHeatingCoolingState.HEAT ],
        [ this.accessory.context.device.targetCoolOnlyStateValue, this.platform.Characteristic.TargetHeatingCoolingState.COOL ],
        [ this.accessory.context.device.targetAutoStateValue, this.platform.Characteristic.TargetHeatingCoolingState.AUTO ],
        [ this.accessory.context.device.targetOffStateValue, this.platform.Characteristic.TargetHeatingCoolingState.OFF ]
    ]);

    this.reverseMapStates = new Map([
        [ this.platform.Characteristic.TargetHeatingCoolingState.HEAT, this.accessory.context.device.targetHeatOnlyStateValue ],
        [ this.platform.Characteristic.TargetHeatingCoolingState.COOL, this.accessory.context.device.targetCoolOnlyStateValue ],
        [ this.platform.Characteristic.TargetHeatingCoolingState.AUTO, this.accessory.context.device.targetAutoStateValue ],
        [ this.platform.Characteristic.TargetHeatingCoolingState.OFF, this.accessory.context.device.targetOffStateValue ]
    ]);
  }

  /**
   * sets up polling using the input function
   */
  poll(fn, frequency) {
    async function run() {
      await fn();
      setTimeout(run, frequency);
    }
    run();
  }

  /*
   * read the specified value from BACNet and return it
   * update internal state with the read value
   * Returns defaultVal if there's a problem
   * optionally round to precision
   */
  async getBACNetValue(name:string, defaultVal:number, precision=-1) {
    let value = defaultVal;

    try {
      // @ts-ignore
      if (-1 !== this.stateObjects[name].type) {
        value = Number(await readBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects[name], 85));

        if(precision != -1){
          value = parseFloat(value.toFixed(precision));
        }
      }
    } catch (err) {
      this.platform.log.error(this.accessory.context.device.name, 'unable to read BACNet', name, err.message);
    }

    if (this.internalStates[name] != value) {
      this.platform.log.info(this.accessory.context.device.name, name, 'value read: ', String(value));
      this.internalStates[name] = value;
    }

    return (value);
  }

  /*
   * write the specified value to BACNet
   * update internal state
   */
  async setBACNetValue(name:string, value:number, valueType:number) {
    try {
      await writeBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects[name], 85, value, valueType);
      this.platform.log.info(this.accessory.context.device.name, name, "updated to:", String(value));
      this.internalStates[name] = value;
    }
    catch(err){
      this.platform.log.error(this.accessory.context.device.name, 'unable to write BACNet', name, String(value), err.message);
    }
  }

  /**
   * Reads the current heating / cooling state from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateCurrentHeatingCoolingState() {
    this.platform.log.debug('GET CurrentHeatingCoolingState', this.accessory.context.device.name);

    const priorValueHeat = this.internalStates.currentHeatingState;
    const priorValueCool = this.internalStates.currentCoolingState;
    let valueHeat = Number(await this.getBACNetValue("currentHeatingState", 0));
    let valueCool = Number(await this.getBACNetValue("currentCoolingState", 0));

    if(priorValueHeat != valueHeat || priorValueCool != valueCool) {
      if (Number(valueHeat) > 0) {
        this.internalStates.currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
      } else if (Number(valueCool) > 0) {
        this.internalStates.currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
      } else {
        this.internalStates.currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
      }
      this.platform.log.debug(this.accessory.context.device.name, `currentHeatingCoolingState: ${String(this.internalStates.currentHeatingCoolingState)}`);
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, this.internalStates.currentHeatingCoolingState);
    }
  }

  /**
   * Reads the target heating / cooling state from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateTargetHeatingCoolingState() {
    this.platform.log.debug('GET TargetHeatingCoolingState', this.accessory.context.device.name);

    const priorValue = this.internalStates.targetHeatingCoolingState
    let value = Number(await this.getBACNetValue("targetHeatingCoolingState", -1));

    if(value != priorValue) {
      let valueHK = this.mapStates.has(value) ? this.mapStates.get(value) : this.platform.Characteristic.TargetHeatingCoolingState.OFF;
      this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, valueHK);
    }
  }

  /**
   * Reads the current temperature from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateCurrentTemperature() {
    this.platform.log.debug(this.accessory.context.device.name, 'GET CurrentTemperature');

    const priorValue = this.internalStates.currentTemperature;
    let value = Number(await this.getBACNetValue("currentTemperature", this.accessory.context.device.minTemp, 1));
    value = Math.min(this.accessory.context.device.maxTemp,Math.max(this.accessory.context.device.minTemp,value));

    if(priorValue != value) {
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, value);
    }
  }

  /**
   * Reads the target temperature from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateTargetTemperature() {
    this.platform.log.debug(this.accessory.context.device.name, 'GET TargetTemperature');

    const priorValue = this.internalStates.targetTemperature;
    let value = Number(await this.getBACNetValue("targetTemperature", this.accessory.context.device.minTemp));
    value = Math.min(this.accessory.context.device.maxTemp,Math.max(this.accessory.context.device.minTemp,value));

    if(priorValue != value) {
      this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, value);
    }
  }
  /**
   * Writes the value passed from homebridge to the
   * configured BACnet object and updates the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  async setTargetHeatingCoolingState(valueHK, callback) {
    this.platform.log.debug(this.accessory.context.device.name, 'SET TargetHeatingCoolingState');
    callback(null);

    if(this.reverseMapStates.has(valueHK)){
      const valueBN = this.reverseMapStates.get(valueHK);
      await this.setBACNetValue("targetHeatingCoolingState", valueBN, 2); // valueType 2 = Unsigned integer. may need to make configurable
    }
  }

  /**
   * Writes the value passed from homebridge to the
   * configured BACnet object and updates the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  async setTargetTemperature(value, callback) {
    this.platform.log.debug(this.accessory.context.device.name, 'SET TargetTemperature');
    callback(null);
    await this.setBACNetValue("targetTemperature", value, 4);// valueType 4 = Real number. may need to make configurable
  }

  /**
   * Reads the display units from the
   * internal state.
   * @param callback Callback from homebridge
   */
  getTemperatureDisplayUnits(callback) {
    this.platform.log.debug(this.accessory.context.device.name, 'GET TemperatureDisplayUnits');
    callback(null, this.internalStates.temperatureDisplayUnits);
  }

  /**
   * Writes the value passed from homebridge to the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  setTemperatureDisplayUnits(value, callback) {
    this.platform.log.debug(this.accessory.context.device.name, 'SET TemperatureDisplayUnits');
    this.internalStates.temperatureDisplayUnits = value;
    callback(null);
  }
}
