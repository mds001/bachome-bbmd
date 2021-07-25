
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

![Build and Lint](https://github.com/Caserage/bachome/workflows/Build%20and%20Lint/badge.svg)

# Bachome BBMD

An extension of bachome, which adds BBMD support using natezimmer_bacstack.  Currently only the homebridge thermostat is supported.

BACnet is a standard used for Building Automation Systems.  There's a guide to it here: https://guides.smartbuildingsacademy.com/definitive-guide-bacnet

The hardware I wanted to get working in homebridge uses BBMD (BACnet Broadcast Management Device), which means a device on a regular IP network that facilitates routing to a separate BACnet network.  To make it work, homebridge needs to know how to address BACnet addresses via the router.  natezimmer-bacstack adds this capability to bacstack (the underlying BACnet service used by bachome).

To use BBMD here, you need to configure:

<ul>
<li>IP address of the BBMD router</li>
<li>Target BACnet network ID on the router</li>
<li>Target BACnet MAC address of the end device</li>
<li>Target object specifications on the BACnet end device, which govern the thermostat</li>
</ul>

In bachome, target object specifications are string values, each 2 tokens separated by ":".  The first value is shorthand for the object value type (see list below).  The second is the object ID.  Eg, "AV:16" means an AnalogValue object with ID 16.

<ul>
<li>AI: AnalogInput</li>
<li>AO: AnalogOutput</li>
<li>AV: AnalogValue</li>
<li>BI: BinaryInput</li>
<li>BO: BinaryOutput</li>
<li>BV: BinaryValue</li>
<li>MSV: MultiStatealue</li>
</ul>

If you don't know what values to configure, you'd need to explore your network with something like Cimetrics BACnet Explorer, for which there is a free version here: https://www.cimetrics.com/collections/bacnet/products/bacnet-explorer

The config schema has descriptions and sample values.  These features should work, but not tested -

<ul>
<li>Set a target state object spec to an empty string to ignore it</li>
<li>Set both net and adr to -1, to disable BBMD (ie treat the target IP as the end BACNet device </li>
</ul>

## Configuring the plugin

This plugin supports visual configuration using the `Homebridge Config UI X` web interface.

If you want to create the configuration manually, you have to register the platform and accessories in your `config.json` file. An example may look like this:

```json
{
    "platforms": [
        {
            "name": "BAChome BBMD",
            "thermostat": [
                {
                    "name": "Kitchen",
                    "manufacturer": "Caserage",
                    "model": "Caserage's thermostat",
                    "serial": "DEF"
                }
            ],
            "platform": "bachome-bbmd"
        }
    ]
}
```

## Install Development Dependencies

Using a terminal, navigate to the project folder and run this command to install the development dependencies:

```
npm install
```

## Build Plugin

TypeScript needs to be compiled into JavaScript before it can run. The following command will compile the contents of your [`src`](./src) directory and put the resulting code into the `dist` folder.

```
npm run build
```

## Link To Homebridge

Run this command so your global install of Homebridge can discover the plugin in your development environment:

```
npm link
```

You can now start Homebridge, use the `-D` flag so you can see debug log messages in your plugin:

```
homebridge -D
```

## Watch For Changes and Build Automatically

If you want to have your code compile automatically as you make changes, and restart Homebridge automatically between changes you can run:

```
npm run watch
```

This will launch an instance of Homebridge in debug mode which will restart every time you make a change to the source code. It will the config stored in the default location under `~/.homebridge`. You may need to stop other running instances of Homebridge while using this command to prevent conflicts. You can adjust the Homebridge startup command in the [`nodemon.json`](./nodemon.json) file.