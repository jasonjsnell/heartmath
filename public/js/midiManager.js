let midiOuts;

/*
EP raw will be a CC, maybe 0-3500?
Coherence will be a CC, 1-5?
*/

let midiCcOn = [true, true, true];

let genMidiCcNumber = 20;
let HEARTBEAT_MIDI_CHANNEL = 1
let HRV_NOTE_MIDI_CHANNEL = 2
let midiChannels = [3, 4, 5];
let midiValues = [127, -1, -1];

//Init WebMIDI
WebMidi.enable(function (err) {
  if (err) {
    console.error("WebMidi could not be enabled.", err);
  } else {
    console.log("WebMidi enabled, outputs:", WebMidi.outputs);

    // Get the output port (your MIDI device)
    midiOuts = WebMidi.outputs;

    console.log("MIDI out", midiOuts);

    // Check if an output is available
    if (!midiOuts) {
      console.error("No MIDI output available.");
      return;
    }

    //set all to zero
    for (let i = 0; i < midiChannels.length; i++) {
      sendMidiCC(i, 0);
    }

  }
});

//send HRV note
function sendHrvNote() {
  for (let i = 0; i < midiOuts.length; i++) {
    let midiOut = midiOuts[i];
    midiOut.playNote("C3", HRV_NOTE_MIDI_CHANNEL);
  }
}

//sketch JS sends over the HRV data and this function converts them to MIDI CCs and sends them out
function convertHrvDataToMidiCC(hrv_smooth, ibiCoherenceScore) {

  //console.log("hrv_smooth", hrv_smooth, "ibiCoherenceScore", ibiCoherenceScore);
  
  let hrvMidiValue = map(hrv_smooth, 0, 50, 0, 127);
  let coherenceScoreMidiValue = map(ibiCoherenceScore, 0, 4, 0, 127);
 
  sendMidiCC(1, hrvMidiValue);
  sendMidiCC(2, coherenceScoreMidiValue);
}

function sendConnectMidiCC(disconnectValue) {
  let disconnectionMidiValue = map(disconnectValue, 0, 100, 0, 127);
  sendMidiCC(0, disconnectionMidiValue);
}

//smoothing
let upInc = 1;
let dnInc = 1

function sendMidiCC(midiID, midiValue) {

  //console.log("Sending MIDI CC", midiID, "value", midiValue);

  //is channel open?
  let channelOpen = midiCcOn[midiID];

  //if open...
  if (channelOpen) {

    //don't send same value repeatedly
    if (midiValue != midiValues[midiID]) {

      //smoothing
      if (midiValue > midiValues[midiID] + upInc) {
        midiValues[midiID] += upInc;
      } else if (midiValue < midiValues[midiID] - dnInc) {
        midiValues[midiID] -= dnInc;
      } else {
        midiValues[midiID] = midiValue;
      }
      //make sure midi value stays an interger
      midiValues[midiID] = parseInt(midiValues[midiID]);
      if (midiValues[midiID] > 127) midiValues[midiID] = 127;
      if (midiValues[midiID] < 0) midiValues[midiID] = 0;

      //get state channel
      let midiChannel = midiChannels[midiID];

      //send to all midi outs
      for (let i = 0; i < midiOuts.length; i++) {
        let midiOut = midiOuts[i];

        midiOut.sendControlChange(
          genMidiCcNumber,
          midiValues[midiID],
          midiChannel
        );

        console.log(
          "Sent CC message:",
          "Channel",
          midiChannel,
          "CC#",
          genMidiCcNumber,
          "Value",
          midiValues[midiID]
        );
      }
    }
  }
}

//TOGGLE STREAMS
//managers if the state data stream is being sent out
//default is off, because ableton will map to all streaming cc'd when doing MIDI mapping

function updatemidiCcOn(midiID, newState) {
  console.log("State", midiID, "is now", newState);
  midiCcOn[midiID] = newState;
}

//Test MIDI button
function testMidiButtonClicked(buttonIndex) {
  //send random value between 0 and 1 to midi CC function
  //this will make sure that it's a different value each time
  console.log("State", buttonIndex, "is send a test message for MIDI mapping");

  //send to all midi outs
  for (let i = 0; i < midiOuts.length; i++) {
    let midiOut = midiOuts[i];

    midiOut.sendControlChange(
      genMidiCcNumber,
      random(127),
      midiChannels[buttonIndex]
    );
  }
}


//timers

let midiBpmActive = false;
function activateMidiBpm(active) {
  midiBpmActive = active;
}

function updateMidiBpm(bpm) {
  if (bpm != undefined) {
    bpmInterval = 60000 / bpm;
    //console.log("BPM is now", bpm, "ms interval is now", bpmInterval);
  }

}

let bpmInterval = 1000; //starts at 60 bpm

function bpmRenderLoop() {

  // Your repeating logic/code here
  //console.log('Running at dynamic interval at ', bpmInterval);
  //console.log('midiBpmActive', midiBpmActive)
  // sketch.js file turns loop on if device is connected and off if device is not
  if (midiBpmActive) {

    //send midi note C3 out on channel 10
    for (let i = 0; i < midiOuts.length; i++) {
      let midiOut = midiOuts[i];

      midiOut.playNote("C3", HEARTBEAT_MIDI_CHANNEL);
    }
  }

  // Schedule the next call based on the current interval
  setTimeout(bpmRenderLoop, bpmInterval);
}

// Kick off the first call
setTimeout(bpmRenderLoop, bpmInterval);