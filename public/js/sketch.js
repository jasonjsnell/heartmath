//instructions
//plug in HRV sensor to usb
//clup usb sensor on your ear
//open up emWave app
//click Run Sessions
//click Start
//it will take a minute to calibrate
//run in terminal: node server.js
//open in chrome, http://localhost:3000/
//when the server is shut down (ctrl C), then emWave will crash
//restart emWave to start again

//Open and connect socket
let socket = io();

//Listen for confirmation of connection
socket.on('connect', function () {
    console.log("P5: Socket.io is now connected");
});

var connected = false;
var connectedCounter = 0;
var CONNECTED_COUNTER_MAX = 15;
var disconnectionScore = 100;

var hr_raw = 60;
var hr_smooth = 60;
var hr_inc = 1;

var ep_raw = 0;
var ep_smooth = 0;
var ep_inc = 5;

var coherenceScores = [];
var coherenceAverage = 0;
var COHERENCE_AVERAGE_BUFFER_SIZE = 64

var hrv_raw = 0;
var hrv_smooth = 0;
var hrv_inc = 2;
var hrvNoteOn = false
hrvNoteThreshold = 50;

var ibiDataForHRV = [];
var IBI_BUFFER_FOR_HRV = 5;
var ibiDataForCoherence = [];
var timeStampDataForCoherence = [];
var IBI_BUFFER_FOR_COHERENCE = 32;
var ibiCoherenceScore = 0

var accumulatedScore = 0;
var interbeatInterval = 0;

function setup() {
    createCanvas(400, 400);
    frameRate(15);
    updateMidiBpm(hr_smooth)

    //Listen for messages named 'data' from the server
    socket.on('heartMathData', function (obj) {

        //console.log("P5: received heartMathData obj", obj)

        //main data objected, called D01
        //has the full set of data values
        if (obj.D01) {

            let _hr_raw = obj.D01.$.HR
            //turn hr_raw into an integer
            _hr_raw = parseInt(_hr_raw)

            updateHR(_hr_raw); //slowly update the smoothed value
            renderHR(); //render the raw value

            //let _ep_raw = obj.D01.$.EP
            //turn ep_raw into an integer
            //_ep_raw = parseInt(_ep_raw)
            //updateEP(_ep_raw)

            accumulatedScore = obj.D01.$.AS

            //get data from object
            let _coherenceScore = obj.D01.$.S
            //convert into an integer
            _coherenceScore = parseInt(_coherenceScore)
            //add to array
            coherenceScores.push(_coherenceScore)
            //if array is more than 20, then remove oldest item
            if (coherenceScores.length > COHERENCE_AVERAGE_BUFFER_SIZE) {
                coherenceScores.shift()
            }

            //get average of array
            //const average = array => array.reduce((a, b) => a + b) / array.length;
            coherenceAverage = coherenceScores.reduce((a, b) => a + b, 0) / coherenceScores.length

            //send IBI to processing func
            processIBI(obj.D01.$.IBI)

        }

        //IBI packets
        if (obj.IBI) {

            //send to processing func
            processIBI(obj.IBI)

            //command packets, ignore
        } else if (obj.CMD) {

            console.log("P5: received CMD obj", obj.CMD)

        }
    });
}

function processIBI(ibiData) {

    //convert value to integer
    interbeatInterval = parseInt(ibiData)

    //if the sensor is receiving interbeat data, then there is a valid sensor connection
    //using IBI as the test variable because it updates the most often
    if (interbeatInterval > 0) {
        //make connected flag true so music and visuals can render
        maintainConnection()

        //process HRV, smaller array
        //add to HRV array
        ibiDataForHRV.push(interbeatInterval)
        //if array is more than 5, then remove oldest item
        if (ibiDataForHRV.length > IBI_BUFFER_FOR_HRV) {
            ibiDataForHRV.shift()
        }

        updateHRV(calculateSDNN(ibiDataForHRV))

        //process coherence, which requires an FFT and a larger array

        //add ibi and timestamps to arrays
        timeStampDataForCoherence.push(Date.now())
        ibiDataForCoherence.push(interbeatInterval)
        //if array is more than 32, then remove oldest item
        if (ibiDataForCoherence.length > IBI_BUFFER_FOR_COHERENCE) {
            ibiDataForCoherence.shift()
            timeStampDataForCoherence.shift()
            ibiCoherenceScore = calculateCoherence(ibiDataForCoherence, timeStampDataForCoherence)
            //console.log("ibiCoherenceScore", ibiCoherenceScore)
        }
    }
}

function updateHR(hr) {
    this.hr_raw = hr;
}

function renderHR() {

    if (hr_raw != 0 && hr_raw != hr_smooth) {
        if (hr_raw < hr_smooth - hr_inc) {
            hr_smooth -= hr_inc;
        } else if (hr_raw > hr_smooth + hr_inc) {
            hr_smooth += hr_inc;
        } else {
            hr_smooth = hr_raw;
        }

        updateMidiBpm(hr_smooth)
    }
}

function updateHRV(hrv) {
    this.hrv_raw = hrv;

    if (hrv_raw > hrvNoteThreshold && !hrvNoteOn) {
        console.log("hrvNoteOn")
        sendHrvNote()
        hrvNoteOn = true
    }
    if (hrv_raw < hrvNoteThreshold) {
        hrvNoteOn = false
    }
}

function renderHRV() {
    if (hrv_raw < hrv_smooth - hrv_inc) {
        hrv_smooth -= hrv_inc;
    } else if (hrv_raw > hrv_smooth + hrv_inc) {
        hrv_smooth += hrv_inc;
    } else {
        hrv_smooth = hrv_raw;
    }
}


function maintainConnection() {
    
    connected = true;
    connectedCounter = 0;
    disconnectionScore = 0;
    activateMidiBpm(true)
}

function draw() {

    connectedCounter++;
    
    if (connectedCounter > CONNECTED_COUNTER_MAX) {
        connected = false;
        disconnectionScore += 2;
        if (disconnectionScore > 100) { disconnectionScore = 100 }
        activateMidiBpm(false)
        console.log("WARNING: not connected to emWave")
        
    }
    //always update connection status
    sendConnectMidiCC(disconnectionScore)

    //update and interpolate values
    //renderEP();
    renderHRV();

    background(200);

    textSize(18);
    fill(100)

    text('Connected = ' + connected + ' | ' + (100 - disconnectionScore), 10, 20)

    text('Heart Rate = ' + hr_raw + ' | ' + hr_smooth, 10, 40);

    text('HRV = ' + hrv_raw.toFixed(0) + ' | ' + hrv_smooth.toFixed(0), 10, 60);

    text('HM Coherence = ' + coherenceAverage.toFixed(2), 10, 80);
    text('JS Coherence = ' + ibiCoherenceScore.toFixed(2), 10, 100);

    //text('EP = ' + ep_smooth.toFixed(2), 10, 120);

    text('Interbeat Interval = ' + interbeatInterval, 10, 140);

    if (connected) {
        //send to midi manager for conversion to midi cc
        convertHrvDataToMidiCC(hrv_smooth, ibiCoherenceScore)
    }


}


//subs
function calculateSDNN(ibiData) {
    // 1. Calculate the mean of the IBIs.
    let sum = ibiData.reduce((a, b) => a + b, 0);
    let mean = sum / ibiData.length;

    // 2. For each IBI, find the squared difference from the mean.
    let squaredDiff = ibiData.map(value => Math.pow(value - mean, 2));

    // 3. Average all the squared differences.
    let averageSquaredDiff = squaredDiff.reduce((a, b) => a + b, 0) / ibiData.length;

    // 4. Take the square root of that average to get the standard deviation (SDNN).
    let sdnn = Math.sqrt(averageSquaredDiff);

    return sdnn;
}

function calculateCoherence(ibiValues, timestamps) {

    //deep, long breaths bring this number up
    let sd = standardDeviation(ibiValues);
    let score = map(sd, 10, 150, 0, 6)

    return score
}


function standardDeviation(values) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b) / n;
    return Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
}


// function calculateRMSSD(ibiData) {
//     if (ibiData.length > 2) {

//         // 1. Calculate the successive differences between each adjacent IBI.
//         let successiveDifferences = [];
//         for (let i = 1; i < ibiData.length; i++) {
//             successiveDifferences.push(ibiData[i] - ibiData[i - 1]);
//         }

//         // 2. Square each of these differences.
//         let squaredDifferences = successiveDifferences.map(diff => Math.pow(diff, 2));

//         // 3. Find the mean of these squared differences.
//         let sumOfSquaredDifferences = squaredDifferences.reduce((a, b) => a + b, 0);
//         let meanOfSquaredDifferences = sumOfSquaredDifferences / squaredDifferences.length;

//         // 4. Take the square root of this mean to get RMSSD.
//         let rmssd = Math.sqrt(meanOfSquaredDifferences);

//         return rmssd;
//     }
// }