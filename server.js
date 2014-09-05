var request = require('request-json');
var async = require('async');

var loggly = require('loggly');

var common = require('./common')
var piGlow = require('piglow');

var config = common.config();

var client = loggly.createClient({
    token: "938edd34-64c3-4da1-9635-275eb194beb4",
    subdomain: "ideallog",
    tags: ["NodeJS"],
    json:true
});

client.log("Starting app");

if (process.getuid) {
  console.log('Current uid: ' + process.getuid());
}

if (process.getgroups) {
  console.log('Current groups: ' + process.getgroups());
}

var LEDs = []

for (i = 0; i < 16; i++) {
  LEDs[i] = 0;
}

if (config.piglow) {
  piGlow(function(error, pi) {
      if(error) {
        console.log(error);
      }
      piglow = pi;
      piglow.reset;
      //pi.all;
  });
}

setInterval(function(){
  if ('undefined' !== typeof piglow) {
    piglow.startTransaction();
    for (i = 0; i < 16; i++) {
      if (LEDs[i] > 0) {
        LEDs[i]-=1;
      }
    }
    // Mapping from basestation LED layout (top left to bottom righ) to piglow layout: 
    piglow.l_1_2 = LEDs[0];
    piglow.l_1_5 = LEDs[1];
    piglow.l_2_5 = LEDs[2];
    piglow.l_2_4 = LEDs[3];
    piglow.l_0_5 = LEDs[4];
    piglow.l_2_3 = LEDs[5];
    piglow.l_0_1 = LEDs[6];
    piglow.l_2_2 = LEDs[7];
    piglow.l_1_1 = LEDs[8];
    piglow.l_1_0 = LEDs[9];
    piglow.l_1_3 = LEDs[10];
    piglow.l_1_4 = LEDs[11];
    piglow.l_0_3 = LEDs[12];
    piglow.l_0_2 = LEDs[13];
    piglow.l_0_1 = LEDs[14];
    piglow.l_0_0 = LEDs[15];
    piglow.commitTransaction();
  }
}, 10);

currentLED = 0;

setInterval(function(){
  LEDs[currentLED] = 255;
}, 100);

const HomeOffset = 0;
const BaseStationAddress = process.env.RESIN_DEVICE_UUID;
config['basestationID'] = process.env.RESIN_DEVICE_UUID;

var IDEALJSONClient = request.newClient(process.env.IDEAL_SERVER);

var serialport = require("serialport")
var SerialPort = serialport.SerialPort
var serialPort = new SerialPort(process.env.IDEAL_SERIAL, {
  baudrate: 38400,
  parser: serialport.parsers.readline("\n")
});

function sendJSON(data) {
  IDEALJSONClient.post('jsonreading/', data, function (err, res, body) {
      if(res) {
        //console.log(err);
        client.log({"statusCode": res.statusCode});
      }
  });
}

serialPort.on("open", function () {
  serialPort.on('data', function(data) {
    console.log('data received : ' + data);
    try {
      js_data = JSON.parse(data);
    } catch (er) {
      return;
    }
    JSON_data = {
      "basestation_address": config.basestationID,
      "sensorbox_address": js_data.node_id + config.homeOffset,
      "timestamp": (Date.now())/100,
      "timeinterval": 60
    }
    if (config.piglow) {
      //LEDs[js_data.node_id] = 255;
    }
    switch(js_data.packet_type) {
      case 1: // TEMP_HUM
        JSON_data["internal_temperature"] = js_data.val0;
        JSON_data["humidity"] = js_data.val1;
        client.log(JSON_data);
        sendJSON(JSON_data);
        break;
      case 2: // BROADCAST
        break;
      case 3: // CURRENT
        JSON_data["current"] = js_data.val0;
        client.log(JSON_data);
        sendJSON(JSON_data);
        break;
      case 4: // CLAMPS
        JSON_data["clamp_temperature1"] = js_data.val0;
        JSON_data["clamp_temperature2"] = js_data.val1;
        client.log(JSON_data);
        sendJSON(JSON_data);
        break;
      case 5: // LIGHT
        JSON_data["light"] = js_data.val0;
        client.log(JSON_data);
        sendJSON(JSON_data);
        break;
      case 6: // GAS
        JSON_data["gas_pulse"] = 1;
        client.log(JSON_data);
        sendJSON(JSON_data);
        break;
    }
  });
});

serialPort.on("error", function (_error) {
  client.log("Serial Port error: " + _error)
})


process.on('uncaughtException', function(err) {
    // handle the error safely
    console.log('uncaughtException: ' + err);
    var killtimer = setTimeout(function() {
          process.exit(1);
        }, 3000);
    // But don't keep the process open just for that!
    killtimer.unref();
});
