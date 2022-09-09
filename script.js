
(function() {

console.log("Hello 🌎");

//used to distinguish between tracks
let trackColors = ["#010101", "#b32311", "#ea4c20", "#3867d9", "#7db1f2", "#e6ecf8", "#bacae9"];
let totalTracks = 0;
let currentColor = "none";

//controling cursor creation and movement
let playbackOn = false;
let movingCursorsExist = false;
let staticCursorPosition = 1;
let movingCursorPosition = 0;
let createMovingFromStatic = true;
let animationEndEventListenerExists = false;

//recording and queueing notes for playback
let armedTrack = null;
let recordedNotes = new Array();
var queuedNotesSources = new Array();
let recording = false;
let timeAtCursorCreationOrResumePlay = null;
let partialBarOffsetTime = 0;
let referenceTime = null;

//tempo variables
let bpm = 120;
let bpmPrevious = null;

//variables used for setting loop
let potentialLeftLoop = null;
let potentialRightLoop = null;
let leftLoop = null;
let rightLoop = null;

//variables used for determining visibilty of bars when scrolling in or out
let maxBars = 64;
let currentBars = maxBars;
let minBars = 4;
let leftmostVisible = 1;
let rightmostVisible = maxBars;
  
//bar locator tool
let barLocatorClicked = null;
let barLocatorLocationFromLeft = null;
let barLocatorLocationFromRight = null;
  
//variables for + and - buttons for midikeyboard and chordmap
let chordMapsOctave = 0;
let QWERTYStartPosition = 24;
let ActiveQWERTYTrackColor = null;
  
//folder and file names
const mainFolderNames = ["Instruments", "Effects", "Synths", "Drums"];
  
const instrumentsFolderList = ["Acoustic", "Synthetic"];
const instrumentsList = [["Piano", "Guitar", "Strings"], 
                         ["Lead", "Bass", "Choir", "Bell"]];
  
const effectsList = ["Reverb", "Delay", "Filter", "EQ", "Chorus", "Phaser", "Distortion", "Gain"];
  
const synthsList = ["Web Audio Synth"];
  
const drumsFolderList = ["Yamaha TG-33", "TR-808 Kit"];
const drumsList = [["Bassdrum", "Clap", "Crash Reverse", "Crash", "Hat Open",
                    "Ride", "Rimshot", "Shaker", "Snap", "Snaredrum 1",
                    "Snaredrum 2", "Snaredrum 3", "Tambourine", "Tom 1", "Tom 2",
                    "Tom 3"], 
                   ["Bassdrum-01", "Bassdrum-02", "Bassdrum-03", "Bassdrum-04", "Bassdrum-05", 
                    "Cabasa", "Clap 808", "Claves", "Cowbell", "Crash-01", 
                    "Crash-02", "Hat Closed", "Hat Open 1", "Rimshot 808", "Snaredrum",
                    "Tom H", "Tom L", "Tom M"]];

//create an audio context object that will handle all the audio routing
const audioContext = new AudioContext();
audioContext.resume();

//audio context can only be resumed upon user action, it's how the API works.
document.addEventListener("click", (event) => {
  audioContext.resume();
});

// audioContext.audioWorklet.addModule('audioworkletmodules.js');
  
//create our audio context routing object which will control all of the sources, effects, chains, controls routing and connection in audio context.
let audioContextRouting = new AudioContextRouting();

function AudioContextRouting() {
  this.trackRoutings = new Array();
  
  this.soloTrack = null;
  
  
  this.addTrackRouting = function(color) {
    const trackRouting = new TrackRouting(color);
    this.trackRoutings.push(trackRouting);
  }
  
  this.deleteTrackRouting = function(color) {
    for (let i = this.trackRoutings.length - 1; i >= 0; --i) {
      if (this.trackRoutings[i].trackColor == color) {
        this.trackRoutings[i].deleteChainRoutings();
        this.trackRoutings[i].disconnectComponents();
        this.trackRoutings.splice(i, 1);
        return;
      }
    }
  }
  
  this.getTrackRoutingByColor = function(color) {
    for (let i = 0; i < this.trackRoutings.length; ++i) {
      if (this.trackRoutings[i].trackColor == color) {
        return this.trackRoutings[i];
      }
    }
  };
  
  this.findModuleChangeParameter = function(trackColor, moduleId, moduleType, parameterName, parameterIndex, newValue) {
    if ((moduleType == "Instrument") || (moduleType == "Synth") || (moduleType == "Drum")) {
      for (let i = 0; i < this.trackRoutings.length; ++i) {
        if (this.trackRoutings[i].trackColor == trackColor) {
          for (let j = 0; j < this.trackRoutings[i].chainRoutings.length; ++j) {
            if (this.trackRoutings[i].chainRoutings[j].sourceuniqueid == moduleId) {
              if (moduleType == "Synth") {
                this.trackRoutings[i].chainRoutings[j].source.setParameter(parameterName, parameterIndex, newValue);
              } else if (moduleType == "Instrument") {
                this.trackRoutings[i].chainRoutings[j].setParameter(parameterName, parameterIndex, newValue);
              }
            }
          }
        }
      }
    }

    
  }
  
  this.makeSoloTrack = function(color, soloButton) {
    const soloButtons = document.getElementsByClassName("solo");
    for (let i = 0; i < soloButtons.length; ++i) {
      if (!soloButtons[i].classList.contains("chainsolo")) {
        soloButtons[i].classList.remove("soloactive");
      }
    }
    
    for (let i = 0; i < this.trackRoutings.length; ++i) {
      if (this.trackRoutings[i].trackColor == color) {
        this.soloTrack = color;
        if (this.trackRoutings[i].mute == "false") {
          this.trackRoutings[i].setGain(this.trackRoutings[i].gainValue);
        }

        this.trackRoutings[i].solo = "true";
        soloButton.classList.add("soloactive");
      } else {
        this.trackRoutings[i].gain.gain.setValueAtTime(0, 0);
        this.trackRoutings[i].solo = "false";
      }
    }

    
  }
  
  this.clearSoloTrack = function() {
    const soloButtons = document.getElementsByClassName("solo");
    for (let i = 0; i < soloButtons.length; ++i) {
      if (!soloButtons[i].classList.contains("chainsolo")) {
        soloButtons[i].classList.remove("soloactive");
      }
    }
    
    for (let i = 0; i < this.trackRoutings.length; ++i) {
        this.soloTrack = null;
        if (this.trackRoutings[i].mute == "false") {
          this.trackRoutings[i].setGain(this.trackRoutings[i].gainValue);
        }
        
        this.trackRoutings[i].solo = "false";
    } 
  }
  
  this.makeSoloChain = function(color, index, soloButton) {
    const soloButtons = document.getElementsByClassName("solo");
    for (let i = 0; i < soloButtons.length; ++i) {
      if (soloButtons[i].classList.contains("chainsolo") && (soloButtons[i].id.substring(soloButtons[i].id.length - 7) == soloButton.id.substring(soloButton.id.length - 7))) {
        soloButtons[i].classList.remove("soloactive");
      }
    }
    
    for (let i = 0; i < this.trackRoutings.length; ++i) {
      if (this.trackRoutings[i].trackColor == color) {
        for (let j = 0; j < this.trackRoutings[i].chainRoutings.length; ++j) {
          if (this.trackRoutings[i].chainRoutings[j].numChain == index) {
            this.trackRoutings[i].soloChain = j + 1;
            if (this.trackRoutings[i].chainRoutings[j].mute == "false") {
              this.trackRoutings[i].chainRoutings[j].setGain(this.trackRoutings[i].chainRoutings[j].gainValue);
            }
            
            this.trackRoutings[i].chainRoutings[j].solo = "true";
            soloButton.classList.add("soloactive");
          } else {
            this.trackRoutings[i].chainRoutings[j].gain.gain.setValueAtTime(0, 0);
            this.trackRoutings[i].chainRoutings[j].solo = "false";
          }
        }
      } 
    }
  }
  
  this.clearSoloChain = function(color, soloButton) {
    const soloButtons = document.getElementsByClassName("solo");
    for (let i = 0; i < soloButtons.length; ++i) {
      if (soloButtons[i].classList.contains("chainsolo") && (soloButtons[i].id.substring(soloButtons[i].id.length - 7) == soloButton.id.substring(soloButton.id.length - 7))) {
        soloButtons[i].classList.remove("soloactive");
      }
    }
    
    for (let i = 0; i < this.trackRoutings.length; ++i) {
      if (this.trackRoutings[i].trackColor == color) {
        for (let j = 0; j < this.trackRoutings[i].chainRoutings.length; ++j) {
          this.trackRoutings[i].soloChain = null;
          if (this.trackRoutings[i].chainRoutings[j].mute == "false") {
            this.trackRoutings[i].chainRoutings[j].setGain(this.trackRoutings[i].chainRoutings[j].gainValue);
          }
          
          this.trackRoutings[i].chainRoutings[j].setGain(this.trackRoutings[i].chainRoutings[j].gainValue);
          this.trackRoutings[i].chainRoutings[j].solo = "false";
        }
      }
    } 
  }
  
}

function TrackRouting(color) {
  this.trackColor = color;
  
  this.gainValue = 0.2;
  this.panningValue = 0;
  this.stereoValue = 0;
  this.mute = "false";
  this.solo = "false";
  this.soloChain = null;
  
  this.chainRoutings = new Array();
  this.effectsRouting = new Array();
  this.gain = audioContext.createGain();
  this.gain.gain.setValueAtTime(0.2, audioContext.currentTime);
  this.panning = audioContext.createStereoPanner();
  this.stereoDelay = audioContext.createDelay();
  this.stereoDelay.delayTime.setValueAtTime(0.0, audioContext.currentTime);
  this.stereoLeft = audioContext.createStereoPanner();
  this.stereoRight = audioContext.createStereoPanner();
  
  this.deleteChainRoutings = function() {
    for (let i = this.chainRoutings.length - 1; i >= 0; --i) {
      this.chainRoutings[i].disconnectComponents();
      this.chainRoutings.splice(i, 1);
    }
  }
  
  this.disconnectComponents = function() {   
    for (let i = this.effectsRouting.length - 1; i >= 0; --i) {
      this.effectsRouting[i].effectin.disconnect();
      this.effectsRouting[i].effectout.disconnect();
      this.effectsRouting.splice(i, 1);
    }
    
    this.gain.disconnect();
    this.panning.disconnect();
    this.stereoDelay.disconnect();
    this.stereoLeft.disconnect();
    this.stereoRight.disconnect();
  }
  
  this.playKey = function(key, time) {
    for (let i = 0; i < this.chainRoutings.length; ++i) {
      this.chainRoutings[i].playKey(key, time);
    }
  }
  
  this.playPad = function(pad, time) {
    this.chainRoutings[pad - 1].playPad(time);
  }
  
  this.getChainRoutingByIndex = function(index) {
    for (let i = 0; i < this.chainRoutings.length; ++i) {
      if (this.chainRoutings[i].numChain == index) {
        return this.chainRoutings[i];
      }
    }
  };
  
  this.addEffect = function(name, uniqueid) {
    
    let newEffect;
    if (name == "Reverb") {
      newEffect = new Reverb(uniqueid);
      this.effectsRouting.push(newEffect);
    } else if (name == "Delay") {
      newEffect = new Delay(uniqueid);
      this.effectsRouting.push(newEffect);
    } else {
      
    }
    //depending on how many effects, change the way audionodes are connected.
    if (this.effectsRouting.length == 1) {
      for (let i = 0; i < this.chainRoutings.length; ++i) {
        this.chainRoutings[i].stereoLeft.disconnect(this.gain);
        this.chainRoutings[i].stereoRight.disconnect(this.gain);
        this.chainRoutings[i].stereoLeft.connect(this.effectsRouting[0].effectin);
        this.chainRoutings[i].stereoRight.connect(this.effectsRouting[0].effectin);
        this.effectsRouting[0].effectout.connect(this.gain);
      }
    } else {
      const length = this.effectsRouting.length;
      this.effectsRouting[length - 2].effectout.disconnect(this.gain);
      this.effectsRouting[length - 2].effectout.connect(this.effectsRouting[length - 1].effectin);
      this.effectsRouting[length - 1].effectout.connect(this.gain);
    }
    
  }
  
  this.setEffect = function(effect) {
    this.effectsRouting[this.effectsRouting.length - 1] = effect;
  }
  
  this.removeEffect = function(uniqueid) {
    for (let i = 0; i < this.effectsRouting.length; ++i) {
      
      if (this.effectsRouting[i].effectuniqueid == uniqueid) {
        if (this.effectsRouting.length == 1) {
          this.effectsRouting[i].effectout.disconnect(this.gain);
          //since only one effect, after disconnecting from gain, connnect chainroutings stereoleft and stereorights to gain.
          for (let j = 0; j < this.chainRoutings.length; ++j) {
            this.chainRoutings[j].stereoLeft.disconnect(this.effectsRouting[i].effectin);
            this.chainRoutings[j].stereoRight.disconnect(this.effectsRouting[i].effectin);
            this.chainRoutings[j].stereoLeft.connect(this.gain);
            this.chainRoutings[j].stereoRight.connect(this.gain);
          }
        } else if (i == 0) {
          this.effectsRouting[i].effectout.disconnect(this.effectsRouting[i + 1].effectin);
          //since first effect, connect chainroutings stereoleft and stereorights to next one. 
          for (let j = 0; j < this.chainRoutings.length; ++j) {
            this.chainRoutings[j].stereoLeft.disconnect(this.effectsRouting[i].effectin);
            this.chainRoutings[j].stereoRight.disconnect(this.effectsRouting[i].effectin);
            this.chainRoutings[j].stereoLeft.connect(this.effectsRouting[i + 1].effectin);
            this.chainRoutings[j].stereoRight.connect(this.effectsRouting[i + 1].effectin);
          }
          
        } else if (i == this.effectsRouting.length - 1) {
          this.effectsRouting[i - 1].effectout.disconnect(this.effectsRouting[i].effectin);
          this.effectsRouting[i].effectout.disconnect(this.gain);
          this.effectsRouting[i - 1].effectout.connect(this.gain);
        } else {
          this.effectsRouting[i - 1].effectout.disconnect(this.effectsRouting[i].effectin);
          this.effectsRouting[i].effectout.disconnect(this.effectsRouting[i + 1].effectin);
          this.effectsRouting[i - 1].effectout.connect(this.effectsRouting[i + 1].effectin);
        }
        return this.effectsRouting.splice(i, 1);
      }
    }
  }
  
  this.setGain = function(gain) {
    this.gainValue = gain;
    if ((this.mute == "false") && ((audioContextRouting.soloTrack == null) || (audioContextRouting.soloTrack == this.trackColor))) {

      if (gain == 0) {
        this.gain.gain.setValueAtTime(0.2, 0);
      } else if (gain > 0) {
        this.gain.gain.setValueAtTime(0.2 * getBaseLog(4, gain), 0);
      } else if (gain < 0) { 
        this.gain.gain.setValueAtTime(0.2 / getBaseLog(4, Math.abs(gain)), 0);
      } else {
        console.log("error setting gain");
      }
      if (gain == -100) {
        this.gain.gain.setValueAtTime(0, 0);
      }
    }

  };
  
  this.setPanning = function(panning) {
    this.panningValue = panning;
    this.panning.pan.setValueAtTime(panning * 0.01, 0);
  };
  
  this.setStereo = function(stereo) {
    this.stereoValue = stereo;
    this.stereoDelay.delayTime.setValueAtTime(0.020 * stereo * 0.01, audioContext.currentTime);
    this.stereoLeft.pan.setValueAtTime(stereo * -0.01, 0);
    this.stereoRight.pan.setValueAtTime(stereo * 0.01, 0);
  };
  
  this.toggleMute = function() {
    if (this.mute == "false") {
      this.mute = "true";
      this.gain.gain.setValueAtTime(0, 0);
    } else {
      this.mute = "false";
      this.setGain(this.gainValue);
    }
  }
  
  this.soloTrack = function(soloButton) {
    if (this.solo == "false") {
      this.solo = "true";
      audioContextRouting.makeSoloTrack(this.trackColor, soloButton);
    } else {
      this.solo = "false";
      audioContextRouting.clearSoloTrack();
    }
  }
  
  this.connectControls = function() {
    this.gain.connect(this.panning);
    this.panning.connect(this.stereoDelay);
    this.panning.connect(this.stereoRight);
    this.stereoDelay.connect(this.stereoLeft);
  }
  
  this.connectToDestination = function() {
    this.stereoLeft.connect(audioContext.destination);
    this.stereoRight.connect(audioContext.destination);
  }
  
  this.connectControls();
  this.connectToDestination();

}

function ChainRouting(color, numChain) {
  this.trackColor = color;
  this.numChain = numChain;
  
  this.gainValue = 0.2;
  this.panningValue = 0;
  this.stereoValue = 0;
  this.mute = "false";
  this.solo = "false";
  
  this.source = null;
  this.sourceType = null;
  this.sourceuniqueid = null;
  this.effectsRouting = new Array();
  this.gain = audioContext.createGain();
  this.gain.gain.setValueAtTime(0.2, audioContext.currentTime);
  this.panning = audioContext.createStereoPanner();
  this.stereoDelay = audioContext.createDelay();
  this.stereoDelay.delayTime.setValueAtTime(0.0, audioContext.currentTime);
  this.stereoLeft = audioContext.createStereoPanner();
  this.stereoRight = audioContext.createStereoPanner();
  
  this.attack = 0.0; //seconds
  this.decay = 2.0; //seconds
  this.sustain = 100; //% of 0.5 gain value being used
  this.release = 2.0; //seconds
  
  this.disconnectComponents = function() {
    
    for (let i = this.effectsRouting.length - 1; i >= 0; --i) {
      this.effectsRouting[i].effectin.disconnect();
      this.effectsRouting[i].effectout.disconnect();
      this.effectsRouting.splice(i, 1);
    }
    
    this.gain.disconnect();
    this.panning.disconnect();
    this.stereoDelay.disconnect();
    this.stereoLeft.disconnect();
    this.stereoRight.disconnect();
  }

  this.playKey = function(key, time) {
    if (this.source != null) {
      if (this.sourceType == "Instrument") {
        const bufferSource = audioContext.createBufferSource();
        queuedNotesSources.push(bufferSource);
        bufferSource.buffer = this.source[parseInt(key) - 1];
        
        const envelopeGain = audioContext.createGain();
        envelopeGain.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + time + 0);
        envelopeGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + time + this.attack);
        envelopeGain.gain.linearRampToValueAtTime(1 * (this.sustain * 0.01), audioContext.currentTime + time + this.attack + this.decay);
        envelopeGain.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + time + this.attack + this.decay + this.release);
          
        if (this.effectsRouting.length == 0) {
          bufferSource.connect(envelopeGain);
          envelopeGain.connect(this.gain);
          
        } else {          
          bufferSource.connect(envelopeGain);
          envelopeGain.connect(this.effectsRouting[0].effectin);
        }
        if (time != 0) {
          bufferSource.start(audioContext.currentTime + time);
          
        } else {
          bufferSource.start(audioContext.currentTime);
        }

      } else if (this.sourceType == "Synth") {
        if (this.effectsRouting.length == 0) {
          this.source.gain.connect(this.gain);
        } else {
          this.source.gain.connect(this.effectsRouting[0].effectin);
        }
        this.source.playOscillators(parseInt(key) - 1, time);
      }
    }
  }
  
  this.playPad = function(time) { 
    if (this.source != null) {
      if (this.sourceType == "Drum") {

        const bufferSource = audioContext.createBufferSource();
        queuedNotesSources.push(bufferSource);
        bufferSource.buffer = this.source;
        
        const envelopeGain = audioContext.createGain();
        envelopeGain.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + time + 0);
        envelopeGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + time + this.attack);
        envelopeGain.gain.linearRampToValueAtTime(1 * (this.sustain * 0.01), audioContext.currentTime + time + this.attack + this.decay);
        envelopeGain.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + time + this.attack + this.decay + this.release);
        
        if (this.effectsRouting.length == 0) {
          bufferSource.connect(envelopeGain);
          envelopeGain.connect(this.gain);
        } else {
          bufferSource.connect(envelopeGain);
          envelopeGain.connect(this.effectsRouting[0].effectin);
        }
        if (time != 0) {
          bufferSource.start(audioContext.currentTime + time);
        } else {
          bufferSource.start(audioContext.currentTime);
        }
      } else  {
        console.log("error playing pad source");
      }
    }
  }
  
  this.addSource = function(sourceType, source, uniqueid) {
    this.sourceType = sourceType;
    this.sourceuniqueid = uniqueid;
    if (sourceType == "Instrument") {
      AddLoadingInstrumentOverlay(this.trackColor);
      this.source = new Array(88);
        const request = new XMLHttpRequest();
        const instrumentSourceFileName = this.getInstrumentSourceFileName(source);
        request.open('GET', instrumentSourceFileName, true);
        // request.setRequestHeader("Access-Control-Allow-Origin", "*");
        request.responseType = 'arraybuffer';
        request.onload = () => {
          const audioData = request.response;
          audioContext.decodeAudioData(audioData, (buffer) => {

            const bufferAsArray = new Float32Array(buffer.length);
            buffer.copyFromChannel(bufferAsArray, 0, 0);
            for (let i = 0; i < 88; ++i) {
              const keyBufferAsArray = bufferAsArray.slice(4 * i * audioContext.sampleRate, 4 * (i + 1) * audioContext.sampleRate);
              
              
              const keyBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 4, audioContext.sampleRate);
              keyBuffer.copyToChannel(keyBufferAsArray, 0, 0);
              
              this.source[i] = keyBuffer;
              
            }
            RemoveLoadingInstrumentOverlay(this.trackColor);
            },
            (err) => console.error(`Error with decoding audio data: ${err.err}`));
        }
        request.send();

    } else if (sourceType == "Synth") {
      if (source == "Web Audio Synth") {
        this.source = new Synth1();
      }
      
    } else if (sourceType == "Drum") {
      const request = new XMLHttpRequest();
      const drumSourceFileName = this.getDrumSourceFileName(source);
      request.open('GET', drumSourceFileName, true);
      request.responseType = 'arraybuffer';
      request.onload = () => {
        const audioData = request.response;
        audioContext.decodeAudioData(audioData, (buffer) => {
            this.source = buffer;
          },
          (err) => console.error(`Error with decoding audio data: ${err.err}`));
      }
      request.send();
    } else {
      console.log("error getting drum source");
    }

  };
  
  this.getInstrumentSourceFileName = function(source) {
    if (source == "Bass") {
      return "https://cdn.glitch.me/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Bass.wav?v=1662684893439";
    } else if (source == "Bell") {
      return "https://cdn.glitch.me/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Bell.wav?v=1662684900656";
    } else if (source == "Choir") {
      return "https://cdn.glitch.me/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Choir.wav?v=1662684913461";
    } else if (source == "Guitar") {
      return "https://cdn.glitch.me/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Guitar.wav?v=1662684922979";
    } else if (source == "Lead") {
      return "https://cdn.glitch.me/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Lead.wav?v=1662684922144";
    } else if (source == "Piano") {
      return "https://cdn.glitch.me/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Piano.wav?v=1662684923511";
    } else if (source == "Strings") {
      return "https://cdn.glitch.me/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Strings.wav?v=1662685014943";
    } else {
      console.log("error with instrument source file name");
    }
  }


  
  this.getDrumSourceFileName = function(source) {
    // yamaha tg-33 kit
    if (source == "Bassdrum") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Bassdrum.wav?v=1662686881939";
    } else if (source == "Clap") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Clap.wav?v=1662687697786";
    } else if (source == "Crash Reverse") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Crash%20Reverse.wav?v=1662686882157";
    } else if (source == "Crash") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Crash.wav?v=1662686882302";
    } else if (source == "Hat Open") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Hat%20Open.wav?v=1662687523046";
    } else if (source == "Ride") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Ride.wav?v=1662686880868";
    } else if (source == "Rimshot") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Rimshot.wav?v=1662687617064";
    } else if (source == "Shaker") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Shaker.wav?v=1662686880840";
    } else if (source == "Snap") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Snap.wav?v=1662686880926";
    } else if (source == "Snaredrum 1") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Snaredrum%201.wav?v=1662686881035";
    } else if (source == "Snaredrum 2") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Snaredrum%202.wav?v=1662686881182";
    } else if (source == "Snaredrum 3") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Snaredrum%203.wav?v=1662686881307";
    } else if (source == "Tambourine") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Tambourine.wav?v=1662686881395";
    } else if (source == "Tom 1") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Tom%201.wav?v=1662686881501";
    } else if (source == "Tom 2") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Tom%202.wav?v=1662686881669";
    } else if (source == "Tom 3") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Tom%203.wav?v=1662686881923";
    } else {
      //do nothing
    }

    //roland tr-808 kit
    if (source == "Bassdrum-01") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Bassdrum-01.wav?v=1662686888863";
    } else if (source == "Bassdrum-02") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Bassdrum-02.wav?v=1662686890335";
    } else if (source == "Bassdrum-03") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Bassdrum-03.wav?v=1662686889237";
    } else if (source == "Bassdrum-04") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Bassdrum-04.wav?v=1662686889805";
    } else if (source == "Bassdrum-05") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Bassdrum-05.wav?v=1662686890665";
    } else if (source == "Cabasa") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Cabasa.wav?v=1662686886839";
    } else if (source == "Clap 808") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Clap%20808.wav?v=1662687701119";
    } else if (source == "Claves") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Claves.wav?v=1662686887078";
    } else if (source == "Cowbell") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Cowbell.wav?v=1662686887217";
    } else if (source == "Crash-01") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Crash-01.wav?v=1662686888507";
    } else if (source == "Crash-02") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Crash-02.wav?v=1662686889945";
    } else if (source == "Hat Closed") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Hat%20Closed.wav?v=1662686889560";
    } else if (source == "Hat Open 1") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Hat%20Open%201.wav?v=1662687531994";
    } else if (source == "Rimshot 808") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Rimshot%20808.wav?v=1662687620575";
    } else if (source == "Snaredrum") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Snaredrum.wav?v=1662686888706";
    } else if (source == "Tom H") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Tom%20H.wav?v=1662686888657";
    } else if (source == "Tom L") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Tom%20L.wav?v=1662686889862";
    } else if (source == "Tom M") {
      return "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Tom%20M.wav?v=1662686888777";
    } else {
      //do nothing
    }
    
  }
  
  this.setSource = function(source) {
    this.source = source;
  }
  
  this.removeSource = function(uniqueid) {
    if (this.sourceuniqueid == uniqueid) {
      let tempSource = this.source;
      this.source = null;
      this.sourceType = null;
      this.sourceuniqueid = null;
      return tempSource;
    }
  }
  
  this.addEffect = function(name, uniqueid) {
    
    let newEffect;
    if (name == "Reverb") {
      newEffect = new Reverb(uniqueid);
      this.effectsRouting.push(newEffect);
    } else if (name == "Delay") {
      newEffect = new Delay(uniqueid);
      this.effectsRouting.push(newEffect);
    } else {
      
    }
    //depending on how many effects, change the way audionodes are connected.
    if (this.effectsRouting.length == 1) {
      this.effectsRouting[0].effectout.connect(this.gain);
    } else {
      const length = this.effectsRouting.length;
      this.effectsRouting[length - 2].effectout.disconnect(this.gain);
      this.effectsRouting[length - 2].effectout.connect(this.effectsRouting[length - 1].effectin);
      this.effectsRouting[length - 1].effectout.connect(this.gain);
    }
  }
  
  this.setEffect = function(effect) {
    this.effectsRouting[this.effectsRouting.length - 1] = effect;
  }
  
  this.removeEffect = function(uniqueid) {
    for (let i = 0; i < this.effectsRouting.length; ++i) {
      if (this.effectsRouting[i].effectuniqueid == uniqueid) {
        if (this.effectsRouting.length == 1) {
          this.effectsRouting[i].effectout.disconnect(this.gain);
        } else if (i == 0) {
          this.effectsRouting[i].effectout.disconnect(this.effectsRouting[i + 1].effectin);
        } else if (i == this.effectsRouting.length - 1) {
          this.effectsRouting[i - 1].effectout.disconnect(this.effectsRouting[i].effectin);
          this.effectsRouting[i].effectout.disconnect(this.gain);
          this.effectsRouting[i - 1].effectout.connect(this.gain);
        } else {
          this.effectsRouting[i - 1].effectout.disconnect(this.effectsRouting[i].effectin);
          this.effectsRouting[i].effectout.disconnect(this.effectsRouting[i + 1].effectin);
          this.effectsRouting[i - 1].effectout.connect(this.effectsRouting[i + 1].effectin);
        }
        return this.effectsRouting.splice(i, 1);
      }
    }
  }
  
  this.setParameter = function(parameterName, parameterIndex, newValue) {
    if (parameterName == "attack") {
      this.attack = newValue / 25; //attack is between 0 and 4 seconds. 
    } else if (parameterName == "decay") {
      this.decay = newValue / 25; //decay is between 0 and 4 seconds.
    } else if (parameterName == "sustain") {
      this.sustain = newValue;  //sustain is between 0 and 100 percent of oscillators volume. 
    } else if (parameterName == "release") {
      this.release = newValue / 25; //release is between 0 and 4 seconds.
    } else {
      console.log("error");
    }
  }
  
  this.setGain = function(gain) {
    this.gainValue = gain;
    
    if ((this.mute == "false") && ((audioContextRouting.getTrackRoutingByColor(this.trackColor).soloChain == null) || (audioContextRouting.getTrackRoutingByColor(this.trackColor).soloChain == this.numChain))) {
      if (gain == 0) {
        this.gain.gain.setValueAtTime(0.2, 0);
      } else if (gain > 0) {
        this.gain.gain.setValueAtTime(0.2 * getBaseLog(4, gain), 0);
      } else if (gain < 0) { 
        this.gain.gain.setValueAtTime(0.2 / getBaseLog(4, Math.abs(gain)), 0);
      } else {
        console.log("error setting gain");
      }
      if (gain == -100) {
        this.gain.gain.setValueAtTime(0, 0);
      }
    }
  };
  
  this.setPanning = function(panning) {
    this.panningValue = panning;
    this.panning.pan.setValueAtTime(panning * 0.01, 0);
  };
  
  this.setStereo = function(stereo) {
    this.stereoValue = stereo;
    this.stereoDelay.delayTime.setValueAtTime(0.020 * stereo * 0.01, audioContext.currentTime);
    this.stereoLeft.pan.setValueAtTime(stereo * -0.01, 0);
    this.stereoRight.pan.setValueAtTime(stereo * 0.01, 0);
  };
  
  this.toggleMute = function() {
    if (this.mute == "false") {
      this.mute = "true";
      this.gain.gain.setValueAtTime(0, 0);
    } else {
      this.mute = "false";
      this.setGain(this.gainValue);
    }
  }
  
  this.soloChain = function(soloButton) {
    if (this.solo == "false") {
      this.solo = "true";
      audioContextRouting.makeSoloChain(this.trackColor, this.numChain, soloButton);
    } else {
      this.solo = "false";
      audioContextRouting.clearSoloChain(this.trackColor, soloButton);
    }
  }
  
  this.connectControls = function() {
    this.gain.connect(this.panning);
    this.panning.connect(this.stereoDelay);
    this.panning.connect(this.stereoRight);
    this.stereoDelay.connect(this.stereoLeft);
  }
  
  this.connectToTrackControls = function() {
    
    this.stereoLeft.connect(audioContextRouting.getTrackRoutingByColor(this.trackColor).gain);
    this.stereoRight.connect(audioContextRouting.getTrackRoutingByColor(this.trackColor).gain);
  }
  
  this.connectControls();
  this.connectToTrackControls();
  
}

function Reverb(uniqueid) {
  this.effectin = audioContext.createGain();
  this.effectuniqueid = uniqueid;
  this.effect = audioContext.createConvolver();
  this.effectout = audioContext.createGain();
  this.effectin.connect(this.effect);
  this.effect.connect(this.effectout);
  
  const request = new XMLHttpRequest();
  request.open('GET', 'https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/Block%20Inside.wav?v=1660692324175', true);
  request.responseType = 'arraybuffer';
  request.onload = () => {
    const audioData = request.response;
    audioContext.decodeAudioData(audioData, (buffer) => {
        this.effect.buffer = buffer;
      },
      (err) => console.error(`Error with decoding audio data: ${err.err}`));
  }
  request.send();
  
}
  
function Delay(uniqueid) {
  this.effectin = audioContext.createGain();
  this.effectuniqueid = uniqueid;
  this.effect = audioContext.createDelay();
  this.effectout = audioContext.createGain();
  this.effectin.connect(this.effect);
  this.effect.connect(this.effectout);
  
  //original version
  this.effectin.connect(this.effectout);
  
  //set delay
  this.effect.delayTime.setValueAtTime(0.25, audioContext.currentTime);

}
  
function Synth1() {

  this.oscillatorsWaveForms = new Array("sawtooth", "sawtooth", "sawtooth");
  this.oscillatorsOctaveTuning = new Array(0, 0, 0);
  this.oscillatorsHalfStepTuning = new Array(0, 0, 0);
  this.oscillatorsFineTuning = new Array(0, 0, 0);
  this.oscillatorsVoices = new Array(4, 4, 4);
  this.oscillatorsVolumes = new Array(0.5, 0.5, 0.5);
  
  this.attack = 0.05; //seconds
  this.decay = 0.25; //seconds
  this.sustain = 20; //% of 0.5 gain value being used
  this.release = 0.2; //seconds
  
  this.gain = audioContext.createGain();
  this.gain.gain.setValueAtTime(0.05, 0);

  this.playOscillators = function(key, time) {
    
    const twelthRootOfTwo = Math.pow(2, 1/12);
    const keysFromMiddleA = (key - 48);
    let frequency = 440;
    if (keysFromMiddleA >= 0) {
      frequency *= Math.pow(twelthRootOfTwo, keysFromMiddleA);
    } else {
      frequency /= Math.pow(twelthRootOfTwo, -keysFromMiddleA);
    }
    
    for (let i = 0; i < 3; ++i) {
      let oscillatorFrequency = frequency * Math.pow(2, this.oscillatorsOctaveTuning[i]);
      oscillatorFrequency *= Math.pow(twelthRootOfTwo, this.oscillatorsHalfStepTuning[i]);
      for (let j = 0; j < this.oscillatorsVoices[i]; ++j) {
      
        const oscillator = audioContext.createOscillator();
        oscillator.type = this.oscillatorsWaveForms[i];
        oscillator.frequency.setValueAtTime(oscillatorFrequency + (Math.random() * 2 - 1), audioContext.currentTime + time + 0);
        oscillator.detune.setValueAtTime(((Math.random() * 2) - 1) * this.oscillatorsFineTuning[i], audioContext.currentTime + time + 0);
        
        // let lowPassFilter = new AudioWorkletNode(audioContext, 'LowPassFilter');
        // lowPassFilter.parameters.get('frequency').value = 2000;
        
        const envelopeGain = audioContext.createGain();
        envelopeGain.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + time + 0);
        envelopeGain.gain.linearRampToValueAtTime(this.oscillatorsVolumes[i], audioContext.currentTime + time + this.attack);
        envelopeGain.gain.linearRampToValueAtTime(this.oscillatorsVolumes[i] * (this.sustain * 0.01), audioContext.currentTime + time + this.attack + this.decay);
        envelopeGain.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + time + this.attack + this.decay + this.release);

        // oscillator.connect(lowPassFilter);
        // lowPassFilter.connect(envelopeGain);
        // envelopeGain.connect(this.gain);
        
        oscillator.connect(envelopeGain);
        envelopeGain.connect(this.gain);

        oscillator.start(audioContext.currentTime + time + 0);
        oscillator.stop(audioContext.currentTime + time + this.attack + this.decay + this.release);
        oscillator.addEventListener("ended", function() {
          oscillator.disconnect();
          // lowPassFilter.disconnect();
          envelopeGain.disconnect();
        });

        queuedNotesSources.push(oscillator);
      }
    }
    // let myNoise = new AudioWorkletNode(audioContext, 'NoiseSource');
    // let lowPassFilter = new AudioWorkletNode(audioContext, 'LowPassFilter');
    // lowPassFilter.parameters.get('frequency').value = 3000;
    // myNoise.connect(lowPassFilter);
    // lowPassFilter.connect(audioContext.destination);
  }
  
  this.setParameter = function(parameterName, parameterIndex, newValue) {
    if (parameterName == "waveform") {
      let newWaveform = null;
      if (newValue == 1) {
        newWaveform = "sawtooth";
      } else if (newValue == 2) {
        newWaveform = "triangle";
      } else if (newValue == 3) {
        newWaveform = "square";
      } else if (newValue == 4) {
        newWaveform = "sine";
      } else {
        console.log("error");
      }

      this.oscillatorsWaveForms[parameterIndex] = newWaveform;
    } else if (parameterName == "octavetuning") {
      this.oscillatorsOctaveTuning[parameterIndex] = newValue;
    } else if (parameterName == "halfsteptuning") {
      this.oscillatorsHalfStepTuning[parameterIndex] = newValue;
    } else if (parameterName == "finetuning") {
      this.oscillatorsFineTuning[parameterIndex] = newValue;
    } else if (parameterName == "voices") {
      this.oscillatorsVoices[parameterIndex] = newValue;
    } else if (parameterName == "volume") {
      this.oscillatorsVolumes[parameterIndex] = newValue * 0.01;
    } else if (parameterName == "attack") {
      this.attack = newValue / 10; //attack is between 0 and 10 seconds. 
    } else if (parameterName == "decay") {
      this.decay = newValue / 20; //attack is between 0 and 5 seconds.
    } else if (parameterName == "sustain") {
      this.sustain = newValue;  //sustain is between 0 and 100 percent of oscillators volume. 
    } else if (parameterName == "release") {
      this.release = newValue / 40; //release is between 0 and 2.5 seconds.
    } else {
      console.log("error");
    }
  }
  
}



function OffsetTimeByPositionInTrack() {
  let offsetTime = ((movingCursorPosition - 1) * 4) / (bpm / 60);
  offsetTime += partialBarOffsetTime;
  return offsetTime;
}
  
function AdjustTimingForBPMChange() {
  var wasPlaying = playbackOn;
  Pause();
  
  const movingCursors = document.getElementsByClassName("movingcursor");
  const animationSpeed = 4 * (60 / bpm);
  for (let i = 0; i < movingCursors.length; ++i) {
    movingCursors[i].style.animationDuration = animationSpeed.toString() + "s";
  }
  
  const timeAdjustmentRatio = (bpmPrevious / bpm);
  for (let i = 0; i < recordedNotes.length; ++i) {
    recordedNotes[i].time *= timeAdjustmentRatio;
  }
  
  if (wasPlaying) {
    Play();
  }

}


//event listener for plus to add track
document.getElementById("plustrack").addEventListener("click", CreateTrackArea);

//event listeners for master controls
document.getElementById("play").addEventListener("click", Play);
document.getElementById("pause").addEventListener("click", Pause);
document.getElementById("stop").addEventListener("click", Stop);
document.getElementById("record").addEventListener("click", Record);
document.getElementById("loop").addEventListener("click", Loop);

document.getElementById("bpm").addEventListener("input", event => {
  bpmPrevious = bpm;
  bpm = event.currentTarget.value;
  document.getElementById("bpmlabel").innerText = "Tempo: " + bpm.toString();
  AdjustTimingForBPMChange();
});
  
document.getElementById("bpm").addEventListener("dblclick", event => {
  bpmPrevious = bpm;
  event.currentTarget.value = 120; 
  bpm = 120; 
  document.getElementById("bpmlabel").innerText = "Tempo: " + "120";
  AdjustTimingForBPMChange();
});


//event listener for space button to play/pause
addEventListener("keypress", (event) => {
  event.preventDefault();
  if (event.key == " ") {
    if (playbackOn) {
      Pause();
    } else {
      Play();
    }
  } else {
    // console.log("Audio Context Routing: ");
    // console.log(audioContextRouting);
    // console.log("Recorded Notes: ");
    // console.log(recordedNotes);
    // console.log("Audio Context Time: ");
    // console.log(audioContext.currentTime);

  }
});



//add event listeners for the QWERTY keys to play keyboard.

addEventListener("keypress", (event) => {
  event.preventDefault();
  
  let QWERTYstring = "QWERTYUIOP[]";
  for (let i = 0; i < QWERTYstring.length; ++i) {
    if ((event.key == QWERTYstring[i]) || (event.key == QWERTYstring[i].toLowerCase())) {
      const activeKeyboard = document.getElementById("midikeyboard" + ActiveQWERTYTrackColor);
      if (activeKeyboard != null) {
        const activeKeyboardKeys = activeKeyboard.children;
        for (let j = 0; j < activeKeyboardKeys.length; ++j) {
          const activeKeyboardKeysChildren = activeKeyboardKeys[j].children;
          for (let k = 0; k < activeKeyboardKeysChildren.length; ++k) {
            if ((activeKeyboardKeysChildren[k].classList.contains("keylabel")) && ((activeKeyboardKeysChildren[k].innerText == event.key) || (activeKeyboardKeysChildren[k].innerText == event.key.toUpperCase()))) {
              PlayKey(ActiveQWERTYTrackColor, activeKeyboardKeys[j].title, 0);
            }
          }
        }
      }
    }
  }
}); 
  
function getBaseLog(x, y) {
  return Math.log(y) / Math.log(x);
}
  

function clearTextSelection() {
 if (window.getSelection) {
   window.getSelection().removeAllRanges();
  } else if (document.selection) {
    document.selection.empty();
  }
}
  
function AddLoadingInstrumentOverlay(color) {
  const loadingInstrumentOverlay = document.createElement("div");
  loadingInstrumentOverlay.classList.add("loadinginstrumentoverlay");
  loadingInstrumentOverlay.id = "loadinginstrumentoverlay" + color;
  loadingInstrumentOverlay.innerText = "Loading Instrument.. "
  
  const midiKeyboard = document.getElementById("midikeyboard" + color);
  midiKeyboard.appendChild(loadingInstrumentOverlay);
}
  
function RemoveLoadingInstrumentOverlay(color) {
  const loadingInstrumentOverlay = document.getElementById("loadinginstrumentoverlay" + color);
  loadingInstrumentOverlay.remove();
}

document.addEventListener("mousedown", (event) => {

  clearTextSelection();
});

CreateTrackArea();

//create track area with track type choice
function CreateTrackArea() {
  
  //this code is extra protection. 
  //it shouldn't run after plus sign removal is implemeneted.
  if (totalTracks == 7) {
    return;
  }
  //choose a color randomly from trackColors list to use for this track as an id and background color
  currentColor = ChooseTrackColor();
  
  //create trackarea div
  const newTrackArea = document.createElement("div");
  newTrackArea.classList.add("trackarea");
  // newTrackArea.style.backgroundColor = currentColor;
  const color1 = currentColor;
  newTrackArea.id = "trackarea" + currentColor;
  
  //create choosetracktype div
  const chooseTrackType = document.createElement("div");
  chooseTrackType.classList.add("choosetracktype");
  chooseTrackType.id = "choosetracktype" + currentColor;
  
  //create instrument, drum, audio choice for track
  const chooseInstrument = document.createElement("div");
  const chooseDrum = document.createElement("div");
  const chooseAudio = document.createElement("div");
  chooseInstrument.classList.add("tracktype");
  chooseDrum.classList.add("tracktype");
  chooseAudio.classList.add("tracktype");
  chooseAudio.style.opacity = 0.5;
  chooseInstrument.id = "tracktypeinstrument" + currentColor;
  chooseDrum.id = "tracktypedrum" + currentColor;
  chooseAudio.id = "tracktypeaudio" + currentColor;
  chooseInstrument.innerText = "Add Instrument Track";
  chooseDrum.innerText = "Add Drum Track";
  chooseAudio.innerText = "Add Audio Track";
  const textInstrumentTrack = document.createTextNode("Add Instrument Track");
  const textDrumTrack = document.createTextNode("Add Drum Track");
  const textAudioTrack = document.createTextNode("Add Audio Track");
  
  //append tracktype choices to tracktype div, and tracktype div to trackarea div
  chooseTrackType.appendChild(chooseInstrument);
  chooseTrackType.appendChild(chooseDrum);
  chooseTrackType.appendChild(chooseAudio);
  newTrackArea.appendChild(chooseTrackType);
  
  //insert trackarea div into the naindiv before the addtrack div
  const mainDiv = document.getElementById("maindiv");
  mainDiv.appendChild(newTrackArea);
  
  //create event listeners for track type choice buttons.
  let color = currentColor;
  document.getElementById("tracktypeinstrument" + currentColor).addEventListener("click", function(){ currentColor = color; AddInstrumentTrack(); });
  document.getElementById("tracktypedrum" + currentColor).addEventListener("click", function(){ currentColor = color; AddDrumTrack(); });
  document.getElementById("tracktypeaudio" + currentColor).addEventListener("click", function(){ 
    currentColor = color; 
    AddAudioTrack(); 
    chooseAudio.innerText = "Not Implemented Yet";
  });
  
  if (totalTracks == 1) {
    AddMenu();
    document.getElementById("directory").classList.remove("hidden");
  }
  
  //hide plus button if there is 7 tracks.
  if (totalTracks == 7) {
    document.getElementById("addtrack").style.opacity = 0.5;
  }
  
  return;
}

//chose a random track color by accessing the array with a random number
//the random number is based on how many more tracks can be added and there is a counter for it.
function ChooseTrackColor() {
  const random = Math.floor(Math.random() * (7-totalTracks)); 
  let chosenColor = trackColors[random];
  trackColors.splice(random, 1);
  totalTracks += 1;
  return chosenColor;
}


function AddMenu() {
  
  if (document.getElementById("directory").children.length != 0) {
    return;
  }
  
  const folders = document.createElement("div");
  folders.classList.add("folders");
  folders.id = "folders";
  
  for (let i = 0; i < mainFolderNames.length; ++i) {
    const folderSection = document.createElement("div");
    folderSection.classList.add("foldersection");
    folderSection.id = "foldersection" + mainFolderNames[i];
    
    const folder = document.createElement("span");
    folder.classList.add("folder");
    folder.dataset.expanded = "closed";
    folder.id = "folder" + mainFolderNames[i];
    folder.innerText = mainFolderNames[i];
    
    const folderImg = document.createElement("img");
    folderImg.src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/folderclosed-transparent.png?v=1662008848246";
    folderImg.classList.add("foldericon");
    folderImg.id = "folderimg" + "folder" + mainFolderNames[i];
    
    folderImg.addEventListener("click", (event) => {folderImg.parentElement.click();});
    
    folder.appendChild(folderImg);
    
    
    folderSection.appendChild(folder);
    
    var folderContentsNum;
    var folderContentsList;
    var isInstruments = false;
    var isSynths = false;
    var isEffects = false;
    var isDrums = false;
    if (mainFolderNames[i] == "Instruments") {
      folderContentsNum = instrumentsFolderList.length;
      folderContentsList = instrumentsFolderList;
      isInstruments = true;
      //TODO: recreate Assets/Instruments/ folder structure so that everything in Instruments is displayed.
    } else if (mainFolderNames[i] == "Effects") {
      folderContentsNum = effectsList.length;
      folderContentsList = effectsList;
      isEffects = true;
    } else if (mainFolderNames[i] == "Synths") {
      folderContentsNum = synthsList.length;
      folderContentsList = synthsList;
      isSynths = true;
    } else if (mainFolderNames[i] == "Drums") {
      folderContentsNum = drumsFolderList.length;
      folderContentsList = drumsFolderList;
      isDrums = true;
    } else {
      //shouldn't ever execute
      console.log("not a main folder");
    }
    
    
    for (let j = 0; j < folderContentsNum; ++j) {
      if ((!isInstruments) && (!isDrums)) {
        const file = document.createElement("span");
        file.classList.add("file");
        file.classList.add("hidden");
        file.id = "file" + folderContentsList[j];
        file.innerText = folderContentsList[j];
        
        
        const fileImg = document.createElement("img");
        fileImg.src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/fileicon-transparent.png?v=1662010111694";
        fileImg.classList.add("fileicon");
        fileImg.id = "fileimg" + "file" + folderContentsList[j];
        
        fileImg.addEventListener("click", (event) => {fileImg.parentElement.click();});

        file.appendChild(fileImg);
            
        if (isEffects) {
          file.classList.add("effectfile");
        }
        
        if (isSynths) {
          file.classList.add("sourcefile");
          file.classList.add("synthfile");
        }
        
        folderSection.appendChild(file);
        
        /*this code is for unfinished effects and will be removed eventually*/
        let unfinishedEffects = ["Filter", "EQ", "Chorus", "Phaser", "Distortion"];
        let fileIsUnfinishedEffect = false;
        for (let effect = 0; effect < unfinishedEffects.length; ++effect) {
          if (unfinishedEffects[effect] == file.innerText) {
            fileIsUnfinishedEffect = true;
          }
        }
        if (!fileIsUnfinishedEffect) {
          MakeDraggable(file);
        } else {
          file.style.opacity = 0.5;
        }
        


        
      } else {
        const newFolderSection = document.createElement("div");
        newFolderSection.classList.add("foldersection");
        newFolderSection.classList.add("hidden");
        newFolderSection.id = "foldersection" + folderContentsList[j];

        const newFolder = document.createElement("span");
        newFolder.classList.add("folder");
        newFolder.dataset.expanded = "closed";
        newFolder.id = "folder" + folderContentsList[j];
        newFolder.innerText = folderContentsList[j];
            
        const folderImg = document.createElement("img");
        folderImg.src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/folderclosed-transparent.png?v=1662008848246";
        folderImg.classList.add("foldericon");
        folderImg.id = "folderimg" + "folder" + mainFolderNames[i];
        
        folderImg.addEventListener("click", (event) => {folderImg.parentElement.click();});

        newFolder.appendChild(folderImg);
        newFolderSection.appendChild(newFolder);
        
        var newFolderContentsNum;
        var newFolderContentsList;
        if (isInstruments) {
          newFolderContentsNum = instrumentsList[j].length;
          newFolderContentsList = instrumentsList[j]; 
        } else if (isDrums) {
          newFolderContentsNum = drumsList[j].length;
          newFolderContentsList = drumsList[j]; 
        } else {
          //shouldn't ever execute
          console.log("not valid branch");
        }
        for (let k = 0; k < newFolderContentsNum; ++k) {
          const newFile = document.createElement("span");
          newFile.classList.add("file");
          newFile.classList.add("sourcefile");
          
          if (isInstruments) {
            newFile.classList.add("instrumentfile");
          } else if (isDrums) {
            newFile.classList.add("drumfile");
          } else {
            //shouldn't ever execute
            console.log("not valid branch");
          }

          newFile.classList.add("hidden");
          newFile.id = "file" + newFolderContentsList[k];
          newFile.innerText = newFolderContentsList[k];
          

          const fileImg = document.createElement("img");
          fileImg.src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/fileicon-transparent.png?v=1662010111694";
          fileImg.classList.add("fileicon");
          fileImg.id = "fileimg" + "file" + folderContentsList[j];
          
          fileImg.addEventListener("click", (event) => {fileImg.parentElement.click();});

          newFile.appendChild(fileImg);

          newFolderSection.appendChild(newFile);
          
          MakeDraggable(newFile);
        }

        folderSection.appendChild(newFolderSection);
      }
    }
    
    folders.appendChild(folderSection);
  }
  
  
  const menu = document.getElementById("directory");
  menu.appendChild(folders);
  
  menu.addEventListener("click", function(event){
    var elem = event.target;
    if(elem.tagName.toLowerCase() == "span" && elem !== event.currentTarget)
    {
        if(elem.classList.contains("file") == true)
        {
        }
        if(elem.classList.contains("folder") == true)
        {
            
            if(elem.dataset.expanded == "expanded")
            {

                elem.dataset.expanded = "closed";
            }
            else
            {  

                elem.dataset.expanded = "expanded";
            }
            
            var elements = document.getElementsByTagName("span");
            for (let i = 0; i < elements.length; ++i) {
              if ((elements[i].parentElement == elem.parentElement) && (elements[i] != elem)) {
                if (elem.dataset.expanded == "expanded") {
                  elements[i].classList.remove("hidden");
                  elem.children[0].src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/folderopen-transparent.png?v=1662008848246";
                } else {
                  elements[i].classList.add("hidden");
                  elem.children[0].src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/folderclosed-transparent.png?v=1662008848246";
                }
                
              }
            }
          
            var elements2 = document.getElementsByClassName("foldersection");
            for (let i = 0; i < elements.length; ++i) {
              if ((elements2[i].parentElement == elem.parentElement) && (elements2[i] != elem)) {
                if (elem.dataset.expanded == "expanded") {
                  elements2[i].classList.remove("hidden");
                  elem.children[0].src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/folderopen-transparent.png?v=1662008848246";
                } else {
                  elements2[i].classList.add("hidden");
                  elem.children[0].src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/folderclosed-transparent.png?v=1662008848246";
                }
                
              }
            }

        }
    }
  });
}


function CreateDefaultTrackContents() {
  RemoveTrackTypeChoice();
  CreateTrackLayout();
  AddTrackControls();
  AddClipField();
  return;
}

//removes the div with track type choices. 
function RemoveTrackTypeChoice() {
  const chooseTrackType = document.getElementById("choosetracktype" + currentColor);
  chooseTrackType.remove();
  return;
}

//creates the layout to hold track elements. 
function CreateTrackLayout() {
  
  const trackTabsAndContent = document.createElement("div");
  const trackContent = document.createElement("div");
  const tabContentsContainer = document.createElement("div");

  const trackLeft = document.createElement("div");
  const trackRight = document.createElement("div");
  const trackTopLeft = document.createElement("div");
  const trackBottomLeft = document.createElement("div");
  const trackMisc = document.createElement("div");
  const TrackClipFieldArea = document.createElement("div");
  
  trackTabsAndContent.classList.add("tracktabsandcontent");
  trackContent.classList.add("trackcontent");
  tabContentsContainer.classList.add("tabcontentscontainer");
  trackLeft.classList.add("trackleft");
  trackRight.classList.add("trackright");
  trackTopLeft.classList.add("tracktopleft");
  trackBottomLeft.classList.add("trackbottomleft");
  trackMisc.classList.add("trackmisc");
  TrackClipFieldArea.classList.add("trackclipfieldarea");
  
  trackTabsAndContent.id = "tracktabsandcontent" + currentColor;
  trackContent.id = "trackcontent" + currentColor;
  tabContentsContainer.id = "tabcontentscontainer" + currentColor;
  trackLeft.id = "trackleft" + currentColor;
  trackRight.id = "trackright" + currentColor;
  trackTopLeft.id = "tracktopleft" + currentColor;
  trackBottomLeft.id = "trackbottomleft" + currentColor;
  trackMisc.id = "trackmisc" + currentColor;
  TrackClipFieldArea.id = "trackclipfieldarea" + currentColor;
  
  trackContent.appendChild(trackLeft);
  trackContent.appendChild(trackRight);
  trackLeft.appendChild(trackTopLeft);
  trackLeft.appendChild(trackBottomLeft);
  trackTopLeft.appendChild(trackMisc);
  trackTopLeft.appendChild(TrackClipFieldArea);
  
  
  tabContentsContainer.appendChild(trackContent);
  trackTabsAndContent.appendChild(tabContentsContainer);
  
  const trackArea = document.getElementById("trackarea" + currentColor);
  trackArea.appendChild(trackTabsAndContent);
  
  
  return;
}

function AddTrackControls() {
  const trackControls = document.createElement("div");
  trackControls.classList.add("trackcontrols");
  trackControls.id = "trackcontrols" + currentColor;
  
  const trackControlsSliders = document.createElement("div");
  const trackControlsButtons = document.createElement("div");
  trackControlsSliders.classList.add("trackcontrolssliders");
  trackControlsButtons.classList.add("trackcontrolsbuttons");
  trackControlsSliders.id = "trackcontrolssliders" + currentColor;
  trackControlsButtons.id = "trackcontrolsbuttons" + currentColor;

  const volume = document.createElement("div");
  const panning = document.createElement("div");
  const stereo = document.createElement("div");
  const mute = document.createElement("div");
  const solo = document.createElement("div");
  const arm = document.createElement("div");
  const deleteButton = document.createElement("div");
  
  volume.classList.add("volume");
  panning.classList.add("panning");
  stereo.classList.add("stereo");
  mute.classList.add("mute");
  solo.classList.add("solo");
  arm.classList.add("arm");
  deleteButton.classList.add("deletebutton");
  
  volume.id = "volume" + currentColor;
  panning.id = "panning" + currentColor;
  stereo.id = "stereo" + currentColor;
  mute.id = "mute" + currentColor;
  solo.id = "solo" + currentColor;
  arm.id = "arm" + currentColor;
  deleteButton.id = "deletebutton" + currentColor;
  
  mute.innerText = "Mute";
  solo.innerText = "Solo";
  arm.innerText = "Arm";
  deleteButton.innerText = "Delete";
  
  
  const volumeInput = document.createElement("input");
  const panningInput = document.createElement("input");
  const stereoInput = document.createElement("input");
  
  volumeInput.classList.add("volumeinput");
  panningInput.classList.add("panninginput");
  stereoInput.classList.add("stereoinput");
  
  volumeInput.id = "volumeinput" + currentColor;
  panningInput.id = "panninginput" + currentColor;
  stereoInput.id = "stereoinput" + currentColor;
  
  volumeInput.type = "range";
  panningInput.type = "range";
  stereoInput.type = "range";
  
  volumeInput.min = "-100";
  panningInput.min = "-100";
  stereoInput.min = "0";
  
  volumeInput.max = "100";
  panningInput.max = "100";
  stereoInput.max = "100";
  
  volumeInput.value = "0";
  panningInput.value = "0";
  stereoInput.value = "0";
  
  const volumeInputLabel = document.createElement("label");
  const panningInputLabel = document.createElement("label");
  const stereoInputLabel = document.createElement("label");
  
  volumeInputLabel.htmlFor = "volumeinput" + currentColor;
  panningInputLabel.htmlFor = "panninginput" + currentColor;
  stereoInputLabel.htmlFor = "stereoinput" + currentColor;
  
  volumeInputLabel.classList.add("sliderlabel");
  panningInputLabel.classList.add("sliderlabel");
  stereoInputLabel.classList.add("sliderlabel");
  
  volumeInputLabel.innerText = "Vol";
  panningInputLabel.innerText = "Pan";
  stereoInputLabel.innerText = "Stereo";
  
  volume.appendChild(volumeInputLabel);
  panning.appendChild(panningInputLabel);
  stereo.appendChild(stereoInputLabel);
  
  volume.appendChild(volumeInput);
  panning.appendChild(panningInput);
  stereo.appendChild(stereoInput);
  
  trackControlsSliders.appendChild(volume);
  trackControlsSliders.appendChild(panning);
  trackControlsSliders.appendChild(stereo);
  trackControlsButtons.appendChild(mute);
  trackControlsButtons.appendChild(solo);
  trackControlsButtons.appendChild(arm);
  trackControlsButtons.appendChild(deleteButton);
  
  const trackMisc = document.getElementById("trackmisc" + currentColor);
  trackMisc.appendChild(trackControlsSliders);
  trackMisc.appendChild(trackControlsButtons);
  
  const color = currentColor;
  volumeInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).setGain(event.currentTarget.value);});
  panningInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).setPanning(event.currentTarget.value);});
  stereoInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).setStereo(event.currentTarget.value);});
  
  volumeInput.addEventListener("dblclick", event => {event.currentTarget.value = 0; audioContextRouting.getTrackRoutingByColor(color).setGain(event.currentTarget.value);});
  panningInput.addEventListener("dblclick", event => {event.currentTarget.value = 0;audioContextRouting.getTrackRoutingByColor(color).setPanning(event.currentTarget.value);});
  stereoInput.addEventListener("dblclick", event => {event.currentTarget.value = 0; audioContextRouting.getTrackRoutingByColor(color).setStereo(event.currentTarget.value);});
  
  mute.addEventListener("click", event => {
    audioContextRouting.getTrackRoutingByColor(color).toggleMute();
    if (mute.classList.contains("muteactive")) {
       mute.classList.remove("muteactive");
    } else {
       mute.classList.add("muteactive");
    }
  });
  
  solo.addEventListener("click", event => {
    audioContextRouting.getTrackRoutingByColor(color).soloTrack(solo);

  });
  
  arm.addEventListener("click", event => {
    ArmTrack(color, arm);
                             
  });
  
  deleteButton.addEventListener("click", event => {
    if (!deleteButton.classList.contains("deletebuttonactive")) {
      DeleteTrackVerificationPrompt(color, deleteButton);
    }
  });
  
  return; 
}

function AddTrackToAudioContextRouting() {
  const color = currentColor;
  audioContextRouting.addTrackRouting(color);
}
  
function ArmTrack(color, armButton) {
  
  const armButtons = document.getElementsByClassName("arm");
  for (let i = 0; i < armButtons.length; ++i) {
    armButtons[i].classList.remove("armactive");
  }
  
  if (armedTrack != color) {
    armedTrack = color;
    armButton.classList.add("armactive");
  } else {
    armedTrack = null;
  }
 
}
  
function DeleteTrackVerificationPrompt(color, deleteButton) {
  deleteButton.classList.add("deletebuttonactive")
  
  const verificationPrompt = document.createElement("div");
  verificationPrompt.classList.add("verificationprompt");
  verificationPrompt.id = "verificationprompt" + color;
  
  const yesButton = document.createElement("div");
  const noButton = document.createElement("div");
  
  yesButton.classList.add("verificationpromptbutton");
  noButton.classList.add("verificationpromptbutton");
  
  yesButton.id = "verificationpromptbutton" + "yes" + color;
  noButton.id = "verificationpromptbutton" + "no" + color;
  
  yesButton.innerText = "Yes";
  noButton.innerText = "No";
  
  verificationPrompt.appendChild(yesButton);
  verificationPrompt.appendChild(noButton);
  
  const trackContent = document.getElementById("trackcontent" + color);
  trackContent.appendChild(verificationPrompt);

  yesButton.addEventListener("click", event => {DeleteTrack(color);});
  noButton.addEventListener("click", event => {
    
    verificationPrompt.remove();
    deleteButton.classList.remove("deletebuttonactive");
  });

}
  
function DeleteTrack(color) {
  trackColors.push(color);
  
  totalTracks -= 1;
  
  if (totalTracks == 0) {
    document.getElementById("directory").classList.add("hidden");
    staticCursorPosition = 1;
    movingCursorPosition = 0;
  }
  
  if (totalTracks == 6) {
    document.getElementById("addtrack").style.opacity = 1;
  }

  Pause();
  Stop();

  for (let i = recordedNotes.length - 1; i >= 0; --i) {
    if (recordedNotes[i].trackColor == color) {
      recordedNotes.splice(i, 1);
    }
  }

  document.getElementById("trackarea" + color).remove();
  
  const staticCursor = document.getElementById("staticcursor");
  if (staticCursor == null) {
    const bars = document.getElementsByClassName("bar");
    if (bars.length != 0) {
      CreateStaticCursor(bars[staticCursorPosition - 1].id);
    }
  }

  audioContextRouting.deleteTrackRouting(color);

}

function AddInstrumentTrack() {
  
  AddTrackToAudioContextRouting();

  CreateDefaultTrackContents();
  AddInstrumentTabs();

  AddInstrumentsAndEffectsArea();
  AddInstrumentChains();
  AddInstrumentTrackEffectsChain();
  
  AddClipEditor();
  
  AddMidiKeyboard();
  AddChordMap();
  
  return;
}

function AddInstrumentTabs() {
  
  const tabContainer = document.createElement("div");
  
  const mainTab = document.createElement("div");
  const instrumentsAndEffectsTab = document.createElement("div");
  const clipEditorTab = document.createElement("div");
  
  tabContainer.classList.add("tabcontainer");
  
  mainTab.classList.add("tab");
  instrumentsAndEffectsTab.classList.add("tab");
  clipEditorTab.classList.add("tab");
  
  mainTab.innerText = "Play and Record";
  instrumentsAndEffectsTab.innerText = "Track Loadout";
  clipEditorTab.innerText = "Clip Editor";
  
  mainTab.classList.add("tabopened");
  
  const color = currentColor;
  mainTab.addEventListener("click", function() {
    const trackContent = document.getElementById("trackcontent" + color);
    const instrumentsAndEffectsArea = document.getElementById("instrumentsandeffectsarea" + color);
    const clipEditor = document.getElementById("clipeditor" + color);
    trackContent.classList.remove("hidden");
    instrumentsAndEffectsArea.classList.add("hidden");
    clipEditor.classList.add("hidden");
    
    mainTab.classList.add("tabopened");
    instrumentsAndEffectsTab.classList.remove("tabopened");
    clipEditorTab.classList.remove("tabopened");
    
  });

  
  instrumentsAndEffectsTab.addEventListener("click", function() {
    const trackContent = document.getElementById("trackcontent" + color);
    const instrumentsAndEffectsArea = document.getElementById("instrumentsandeffectsarea" + color);
    const clipEditor = document.getElementById("clipeditor" + color);
    trackContent.classList.add("hidden");
    instrumentsAndEffectsArea.classList.remove("hidden");
    clipEditor.classList.add("hidden");
    
    mainTab.classList.remove("tabopened");
    instrumentsAndEffectsTab.classList.add("tabopened");
    clipEditorTab.classList.remove("tabopened");
  });
  
  clipEditorTab.addEventListener("click", function() {
    const trackContent = document.getElementById("trackcontent" + color);
    const instrumentsAndEffectsArea = document.getElementById("instrumentsandeffectsarea" + color);
    const clipEditor = document.getElementById("clipeditor" + color);
    trackContent.classList.add("hidden");
    instrumentsAndEffectsArea.classList.add("hidden");
    clipEditor.classList.remove("hidden");
    
    mainTab.classList.remove("tabopened");
    instrumentsAndEffectsTab.classList.remove("tabopened");
    clipEditorTab.classList.add("tabopened");
  });
  
  tabContainer.appendChild(mainTab);
  tabContainer.appendChild(instrumentsAndEffectsTab);
  tabContainer.appendChild(clipEditorTab);
  
  const trackTabsAndContentContainer = document.getElementById("tracktabsandcontent" + currentColor);
  const tabContentsContainer = document.getElementById("tabcontentscontainer" + currentColor);
  trackTabsAndContentContainer.insertBefore(tabContainer, tabContentsContainer);

}

function AddInstrumentsAndEffectsArea() {
  const instrumentsAndEffectsArea = document.createElement("div");
  instrumentsAndEffectsArea.classList.add("instrumentsandeffectsarea");
  instrumentsAndEffectsArea.classList.add("hidden");
  instrumentsAndEffectsArea.id = "instrumentsandeffectsarea" + currentColor;
  
  const instrumentsAndEffectsQueues = document.createElement("div");
  instrumentsAndEffectsQueues.classList.add("instrumentsandeffectsqueues");
  instrumentsAndEffectsQueues.id = "instrumentsandeffectsqueues" + currentColor;
  
  const instrumentsAndEffectsTrash = document.createElement("div");
  instrumentsAndEffectsTrash.classList.add("instrumentsandeffectstrash");
  instrumentsAndEffectsTrash.id = "instrumentsandeffectstrash" + currentColor;
  
  const trashImg = document.createElement("img");
  trashImg.src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/trash-image-transparent.png?v=1661986329957";
  trashImg.id = "trashimg";
  
  const moduleInterface = document.createElement("div");
  moduleInterface.classList.add("moduleinterface");
  moduleInterface.id = "moduleinterface" + currentColor;

  const moduleInterfaceMessage = document.createElement("span");
  moduleInterfaceMessage.classList.add("chainmessage2");
  moduleInterfaceMessage.innerText = "Module will appear here";
  
  moduleInterface.appendChild(moduleInterfaceMessage);
  
  instrumentsAndEffectsTrash.appendChild(trashImg);
  
  instrumentsAndEffectsArea.appendChild(instrumentsAndEffectsQueues);
  instrumentsAndEffectsArea.appendChild(instrumentsAndEffectsTrash);
  instrumentsAndEffectsArea.appendChild(moduleInterface);
  
  MakeDroppable(instrumentsAndEffectsTrash);

  const tabContentsContainer = document.getElementById("tabcontentscontainer" + currentColor);
  tabContentsContainer.appendChild(instrumentsAndEffectsArea);

}

function AddInstrumentChains() {
  for (let i = 1; i <= 3; ++i) {
    const instrumentsChain = document.createElement("div");
    instrumentsChain.classList.add("instrumentschain");
    instrumentsChain.id = "instrumentschain" + i.toString() + currentColor;

    const chainRouting = new ChainRouting(currentColor, i);
    audioContextRouting.getTrackRoutingByColor(currentColor).chainRoutings.push(chainRouting);
    
    const instrumentsChainControls = document.createElement("div");
    instrumentsChainControls.classList.add("instrumentschaincontrols");
    instrumentsChainControls.id = "instrumentschaincontrols" + i.toString() + currentColor;
    
    const chainControlsSliders = document.createElement("div");
    const chainControlsButtons = document.createElement("div");
    chainControlsSliders.classList.add("chaincontrolssliders");
    chainControlsButtons.classList.add("chaincontrolsbuttons");
    chainControlsSliders.id = "chaincontrolssliders" + currentColor;
    chainControlsButtons.id = "chaincontrolsbuttons" + currentColor;

    const volume = document.createElement("div");
    const panning = document.createElement("div");
    const stereo = document.createElement("div");
    const mute = document.createElement("div");
    const solo = document.createElement("div");

    volume.classList.add("volume");
    panning.classList.add("panning");
    stereo.classList.add("stereo");
    mute.classList.add("mute");
    solo.classList.add("solo");
    
    volume.classList.add("chainvolume");
    panning.classList.add("chainpanning");
    stereo.classList.add("chainstereo");
    mute.classList.add("chainmute");
    solo.classList.add("chainsolo");
    
    volume.id = "volume" + instrumentsChain.id;
    panning.id = "panning" + instrumentsChain.id;
    stereo.id = "stereo" + instrumentsChain.id;
    mute.id = "mute" + instrumentsChain.id;
    solo.id = "solo" + instrumentsChain.id;

    mute.innerText = "Mute";
    solo.innerText = "Solo";

    const volumeInput = document.createElement("input");
    const panningInput = document.createElement("input");
    const stereoInput = document.createElement("input");

    volumeInput.classList.add("volumeinput");
    panningInput.classList.add("panninginput");
    stereoInput.classList.add("stereoinput");
    
    volumeInput.classList.add("chainvolumeinput");
    panningInput.classList.add("chainpanninginput");
    stereoInput.classList.add("chainstereoinput");

    volumeInput.id = "volumeinput" + instrumentsChain.id;
    panningInput.id = "panninginput" + instrumentsChain.id;
    stereoInput.id = "stereoinput" + instrumentsChain.id;

    volumeInput.type = "range";
    panningInput.type = "range";
    stereoInput.type = "range";

    volumeInput.min = "-100";
    panningInput.min = "-100";
    stereoInput.min = "0";

    volumeInput.max = "100";
    panningInput.max = "100";
    stereoInput.max = "100";

    volumeInput.value = "0";
    panningInput.value = "0";
    stereoInput.value = "0";
    
    
    const volumeInputLabel = document.createElement("label");
    const panningInputLabel = document.createElement("label");
    const stereoInputLabel = document.createElement("label");

    volumeInputLabel.htmlFor = "volumeinput" + currentColor;
    panningInputLabel.htmlFor = "panninginput" + currentColor;
    stereoInputLabel.htmlFor = "stereoinput" + currentColor;

    volumeInputLabel.classList.add("chainsliderlabel");
    panningInputLabel.classList.add("chainsliderlabel");
    stereoInputLabel.classList.add("chainsliderlabel");

    volumeInputLabel.innerText = "Vol";
    panningInputLabel.innerText = "Pan";
    stereoInputLabel.innerText = "Stereo";

    volume.appendChild(volumeInputLabel);
    panning.appendChild(panningInputLabel);
    stereo.appendChild(stereoInputLabel);

    volume.appendChild(volumeInput);
    panning.appendChild(panningInput);
    stereo.appendChild(stereoInput); 
    
    const dropInstrumentsMessage = document.createElement("span");
    dropInstrumentsMessage.classList.add("chainmessage");
    dropInstrumentsMessage.innerText = "Drop (1) Instrument/Synth and Effect(s) here";

    chainControlsSliders.appendChild(volume);
    chainControlsSliders.appendChild(panning);
    chainControlsSliders.appendChild(stereo);
    chainControlsButtons.appendChild(mute);
    chainControlsButtons.appendChild(solo);
    
    instrumentsChainControls.appendChild(chainControlsSliders);
    instrumentsChainControls.appendChild(chainControlsButtons);
    
    instrumentsChain.appendChild(instrumentsChainControls);
    instrumentsChain.appendChild(dropInstrumentsMessage);

    const instrumentsAndEffectQueues = document.getElementById("instrumentsandeffectsqueues" + currentColor);
    instrumentsAndEffectQueues.appendChild(instrumentsChain);
    
    const color = currentColor;
    volumeInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setGain(event.currentTarget.value);});
    panningInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setPanning(event.currentTarget.value);});
    stereoInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setStereo(event.currentTarget.value);});

    volumeInput.addEventListener("dblclick", event => {event.currentTarget.value = 0; audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setGain(event.currentTarget.value);});
    panningInput.addEventListener("dblclick", event => {event.currentTarget.value = 0; audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setPanning(event.currentTarget.value);});
    stereoInput.addEventListener("dblclick", event => {event.currentTarget.value = 0; audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setStereo(event.currentTarget.value);});
    
    mute.addEventListener("click", event => {
      audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).toggleMute();
      if (mute.classList.contains("muteactive")) {
         mute.classList.remove("muteactive");
      } else {
         mute.classList.add("muteactive");
      }
      });
    
    solo.addEventListener("click", event => {audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).soloChain(solo);});
    
    MakeDroppable(instrumentsChain);
  }
}

function AddInstrumentTrackEffectsChain() {
  const trackEffectsChain = document.createElement("div");
  trackEffectsChain.classList.add("trackeffectschain");
  trackEffectsChain.id = "trackeffectschain" + currentColor;
  
  const dropTrackEffectsMessage = document.createElement("span");
  dropTrackEffectsMessage.classList.add("chainmessage2");
  dropTrackEffectsMessage.innerText = "Drop Track Effect(s) here";
  
  trackEffectsChain.appendChild(dropTrackEffectsMessage);

  const instrumentsAndEffectQueues = document.getElementById("instrumentsandeffectsqueues" + currentColor);
  instrumentsAndEffectQueues.appendChild(trackEffectsChain);

  MakeDroppable(trackEffectsChain);
}
  
function AddClipEditor() {
  const clipEditor = document.createElement("div");
  clipEditor.classList.add("clipeditor");
  clipEditor.classList.add("hidden");
  clipEditor.id = "clipeditor" + currentColor;
  clipEditor.innerText = "Coming Soon!";
  
  const tabContentsContainer = document.getElementById("tabcontentscontainer" + currentColor);
  tabContentsContainer.appendChild(clipEditor);

}

  
  
  
function MakeDraggable(element) {
  element.draggable = "true";
  element.addEventListener("dragstart", event => {Drag(event);});
}

function MakeDroppable(element) {
  element.addEventListener("dragover", event => {AllowDrop(event);});
  element.addEventListener("drop", event => {Drop(event);});
}

function Drag(event) {
  event.dataTransfer.setData("dragged", event.currentTarget.id);
  event.dataTransfer.setData("draggedparent", event.target.parentElement.id);
}

function AllowDrop(event) {
  event.preventDefault();
}

function Drop(event) {
  event.preventDefault();
  var id = event.dataTransfer.getData("dragged");
  var idparent = event.dataTransfer.getData("draggedparent");
  var draggedElement = document.getElementById(id);
  var targetContainer = event.currentTarget;
  var draggedFrom = document.getElementById(idparent);
  
  //prevent instrument/synth sourcefiles from being placed in track effects chain
  if ((targetContainer.classList.contains("trackeffectschain")) && (draggedElement.classList.contains("sourcefile"))) {
    return;
  }
  
  //prevent drum files from being placed in instruments chain
  if ((targetContainer.classList.contains("instrumentschain")) && (draggedElement.classList.contains("drumfile"))) {
    return;
  }
  
  //prevent instruments and synths from being placed in drumpads
  if ((targetContainer.classList.contains("drumpad")) && ((draggedElement.classList.contains("instrumentfile")) || (draggedElement.classList.contains("synthfile")))) {
    return;
  }
  
  //for drums, change the target container to the respective drumchain
  if (targetContainer.classList.contains("drumpad")) {
    const dropContainerId = targetContainer.id.substring(7, targetContainer.id.length); 
    const drumChains = document.getElementsByClassName("drumchain");
    for (let i = 0; i < drumChains.length; ++i) {
      if (drumChains[i].id.substring(9, drumChains[i].id.length) == dropContainerId) {
        targetContainer = drumChains[i];
      }
    }
  }
  
  //prevent more than one instrument/synth/drum sourcefile from being placed in a chain
  if (targetContainer.children.length != 0) {
    for (let i = 0; i < targetContainer.children.length; ++i) {
      if ((targetContainer.children[i].classList.contains("sourcefile")) && (draggedElement.classList.contains("sourcefile"))) {
        return;
      }
    }
  }

  //copy the element if its being dragged from files, don't copy if its being dragged between chains.
  var droppedElement;
  var mustRemoveOldModule = false;
  var mustAddControlsModule = false;
  if (draggedElement.classList.contains("file")) {

    var copy = draggedElement.cloneNode(true);
    copy.classList.remove("file");
    copy.classList.add("modulebasic");
    copy.id = "uniqueid=" + (Math.floor(Math.random() * 1000000)).toString();
    copy.children[0].remove(); // remove the fileicon
    MakeDraggable(copy);
    droppedElement = copy;
    mustAddControlsModule = true;
  } else {
    //don't do anything if element is being dropped in the container it came from
    if (draggedElement.parentElement == targetContainer) {
      return;
    }
    droppedElement = draggedElement;
    mustRemoveOldModule = true;
  }
  
  //remove source/effects
  let oldSource = null;
  let oldEffect = null;
  let oldModule = null;
  if (mustRemoveOldModule) {
    var startIndex = null;
    if (draggedFrom.id.substring(0,16) == "instrumentschain") {
      startIndex = 16;
    } else if (draggedFrom.id.substring(0,9) == "drumchain") {
      startIndex = 9;
    }
    var color = draggedFrom.id.substring(draggedFrom.id.length - 7);
    var index = draggedFrom.id.substring(startIndex, draggedFrom.id.length - 7);

    if (droppedElement.classList.contains("instrumentfile")) {
      oldSource = audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).removeSource(id);
      oldModule = document.getElementById("module=" + droppedElement.id);
    } else if (droppedElement.classList.contains("synthfile")) {
      oldSource = audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).removeSource(id);
      oldModule = document.getElementById("module=" + droppedElement.id);
    } else if (droppedElement.classList.contains("effectfile")) {
      if (draggedFrom.id.substring(0,17) == "trackeffectschain") {
        oldEffect = audioContextRouting.getTrackRoutingByColor(color).removeEffect(id);
        oldModule = document.getElementById("module=" + droppedElement.id);
      } else {
        oldEffect = audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).removeEffect(id);
        oldModule = document.getElementById("module=" + droppedElement.id);
      }
    } else if (droppedElement.classList.contains("drumfile")) {
      oldSource = audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).removeSource(id);
      oldModule = document.getElementById("module=" + droppedElement.id);
    } else {
      console.log("error");
    }
  }


  //if target container is trash, remove the dropped element from the dom. 
  if ((targetContainer.classList.contains("instrumentsandeffectstrash")) || (targetContainer.classList.contains("drumandeffectstrash"))) {
    const moduleToRemove = document.getElementById(droppedElement.id);
    const modules = document.getElementsByClassName("modulefull");
    for (let i = 0; i < modules.length; ++i) {
      if ((modules[i].parentElement.id.substring(modules[i].parentElement.id.length - 7, modules[i].parentElement.id.length)) == (moduleToRemove.parentElement.id.substring(moduleToRemove.parentElement.id.length - 7, moduleToRemove.parentElement.id.length))) {
        modules[i].remove();
      }
    }
    droppedElement.remove();
    
    return;
  }
  
  // instrument/synth/drum sourcefile is inserted to the front of the target container
  if ((droppedElement.classList.contains("sourcefile")) && (targetContainer.children.length != 1)) {
    //first element that is not the controls div
    var firstElement = targetContainer.children[1];
    targetContainer.insertBefore(droppedElement, firstElement);
  } else {
    targetContainer.appendChild(droppedElement);
  }
  
  //create source/effects
  var startIndex = null;
  if (targetContainer.id.substring(0,16) == "instrumentschain") {
    startIndex = 16;
  } else if (targetContainer.id.substring(0,9) == "drumchain") {
    startIndex = 9;
  }
  var color = targetContainer.id.substring(targetContainer.id.length - 7);
  var index = targetContainer.id.substring(startIndex, targetContainer.id.length - 7);

  if (droppedElement.classList.contains("instrumentfile")) {
    audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).addSource("Instrument", droppedElement.innerText, droppedElement.id);
    if (oldSource != null) {
      audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).setSource(oldSource);
    }
    if (mustAddControlsModule) {
      AddControlsModuleToTrack("Instrument", droppedElement.innerText, droppedElement.id, color);
    }
  } else if (droppedElement.classList.contains("synthfile")) {
    audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).addSource("Synth", droppedElement.innerText, droppedElement.id);
    if (oldSource != null) {
      audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).setSource(oldSource);
    }

    if (mustAddControlsModule) {
      AddControlsModuleToTrack("Synth", droppedElement.innerText, droppedElement.id, color);
    }
  } else if (droppedElement.classList.contains("effectfile")) {
    if (targetContainer.id.substring(0,17) == "trackeffectschain") {
      audioContextRouting.getTrackRoutingByColor(color).addEffect(droppedElement.innerText, droppedElement.id);
      if (oldEffect != null) {
        audioContextRouting.getTrackRoutingByColor(color).setEffect(oldEffect);
      }
    } else {
      audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).addEffect(droppedElement.innerText, droppedElement.id);
      if (oldEffect != null) {
        audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).setEffect(oldEffect);
      }
    }


    if (mustAddControlsModule) {
      AddControlsModuleToTrack("Effect", droppedElement.innerText, droppedElement.id, color);
    }
  } else if (droppedElement.classList.contains("drumfile")) {
    audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).addSource("Drum", droppedElement.innerText, droppedElement.id);
    if (oldSource != null) {
      audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(index).setSource(oldSource);
    }

    if (mustAddControlsModule) {
      AddControlsModuleToTrack("Drum", droppedElement.innerText, droppedElement.id, color);
    }
  } else {
    console.log("error");
  }
  
  if (oldModule != null) {
      const moduleInterface = document.getElementById("moduleinterface" + color);
      moduleInterface.appendChild(oldModule);
  }
  
  const moduleBasic = document.getElementById(droppedElement.id);
  const modules = document.getElementsByClassName("modulefull");
  for (let i = 0; i < modules.length; ++i) {
    if ((modules[i].parentElement.id.substring(modules[i].parentElement.id.length - 7, modules[i].parentElement.id.length)) == (moduleBasic.parentElement.id.substring(moduleBasic.parentElement.id.length - 7, moduleBasic.parentElement.id.length))) {
      modules[i].classList.add("hidden");
      if (droppedElement.id == modules[i].id.substring(7)) {
         modules[i].classList.remove("hidden");
      }
    }
  }
  
  const instrumentsChains = document.getElementsByClassName("instrumentschain");
  for (let i = 0; i < instrumentsChains.length; ++i) {
    if (instrumentsChains[i].children.length == 3) {
      for (let j = 0; j < instrumentsChains[i].children.length; ++j) {
        if (instrumentsChains[i].children[j].classList.contains("chainmessage")) {
          instrumentsChains[i].children[j].remove();
        }
      }
    }
  }
  
  const drunmChains = document.getElementsByClassName("drumchain");
  for (let i = 0; i < drunmChains.length; ++i) {
    if (drunmChains[i].children.length == 3) {
      for (let j = 0; j < drunmChains[i].children.length; ++j) {
        if (drunmChains[i].children[j].classList.contains("chainmessage")) {
          drunmChains[i].children[j].remove();
        }
      }
    }
  }

  const trackEffectsChains = document.getElementsByClassName("trackeffectschain");
  for (let i = 0; i < trackEffectsChains.length; ++i) {
    if (trackEffectsChains[i].children.length == 2) {
      for (let j = 0; j < trackEffectsChains[i].children.length; ++j) {
        if (trackEffectsChains[i].children[j].classList.contains("chainmessage2")) {
          trackEffectsChains[i].children[j].remove();
        }
      }
    }
  }
  
}

function AddControlsModuleToTrack(moduleType, moduleName, moduleId, color) {
  const moduleInterface = document.getElementById("moduleinterface" + color);

  const module = document.createElement("div");
  module.classList.add("modulefull");
  module.classList.add("hidden");
  module.id = "module=" + moduleId;
  
  const moduleHeader = document.createElement("div");
  moduleHeader.classList.add("modulename");
  moduleHeader.innerText = moduleName;
  
  module.appendChild(moduleHeader);
  
  if (moduleType == "Instrument") {
    const attackContainer = document.createElement("div");
    const decayContainer = document.createElement("div");
    const sustainContainer = document.createElement("div");
    const releaseContainer = document.createElement("div");
    
    attackContainer.classList.add("moduleinputandsliderlabel");
    decayContainer.classList.add("moduleinputandsliderlabel");
    sustainContainer.classList.add("moduleinputandsliderlabel");
    releaseContainer.classList.add("moduleinputandsliderlabel");
    
    const trackColor = color;
    const attack = document.createElement("input");
    attack.classList.add("moduleinput");
    attack.id = "moduleinput" + moduleId;
    attack.type = "range";
    attack.min = "0";
    attack.max = "100";
    attack.value = "50";
    attack.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "attack", null, event.currentTarget.value);});

    const decay = document.createElement("input");
    decay.classList.add("moduleinput");
    decay.id = "moduleinput" + moduleId;
    decay.type = "range";
    decay.min = "0";
    decay.max = "100";
    decay.value = "50";
    decay.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument;", "decay", null, event.currentTarget.value);});

    const sustain = document.createElement("input");
    sustain.classList.add("moduleinput");
    sustain.id = "moduleinput" + moduleId;
    sustain.type = "range";
    sustain.min = "0";
    sustain.max = "100";
    sustain.value = "50";
    sustain.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "sustain", null, event.currentTarget.value);});

    const release = document.createElement("input");
    release.classList.add("moduleinput");
    release.id = "moduleinput" + moduleId;
    release.type = "range";
    release.min = "0";
    release.max = "100";
    release.value = "50";
    release.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "release", null, event.currentTarget.value);});


    
    const attackLabel = document.createElement("label");
    const decayLabel = document.createElement("label");
    const sustainLabel = document.createElement("label");
    const releaseLabel = document.createElement("label");
    
    attackLabel.classList.add("modulesliderlabel");
    decayLabel.classList.add("modulesliderlabel");
    sustainLabel.classList.add("modulesliderlabel");
    releaseLabel.classList.add("modulesliderlabel");
    
    attackLabel.innerText = "Attack";
    decayLabel.innerText = "Decay";
    sustainLabel.innerText = "Release";
    releaseLabel.innerText = "Sustain";

    attackLabel.htmlFor = attack.id;
    decayLabel.htmlFor = decay.id;
    sustainLabel.htmlFor = sustain.id;
    releaseLabel.htmlFor = release.id;
    
    
    
    attackContainer.appendChild(attackLabel);
    attackContainer.appendChild(attack);
    decayContainer.appendChild(decayLabel);
    decayContainer.appendChild(decay);
    sustainContainer.appendChild(sustainLabel);
    sustainContainer.appendChild(sustain);
    releaseContainer.appendChild(releaseLabel);
    releaseContainer.appendChild(release);
    
    module.appendChild(attackContainer);
    module.appendChild(decayContainer);
    module.appendChild(sustainContainer);
    module.appendChild(releaseContainer);
    
    
  } else if (moduleName == "Web Audio Synth") {
    const trackColor = color;
    for (let i = 0; i < 3; ++i) {
      const oscillator = document.createElement("div");
      oscillator.classList.add("moduleoscillator");
      
      const waveformContainer = document.createElement("div");
      const octaveTuningContainer = document.createElement("div");
      const halfStepTuningContainer = document.createElement("div");
      const fineTuningContainer = document.createElement("div");
      const voicesContainer = document.createElement("div");
      const volumeContainer = document.createElement("div");
      
      const waveform = document.createElement("input");
      waveform.classList.add("moduleinput");
      waveform.type = "range";
      waveform.min = "1";
      waveform.max = "4";
      waveform.value = "1";
      waveform.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Synth", "waveform", i, event.currentTarget.value);});
      
      const octaveTuning = document.createElement("input");
      octaveTuning.classList.add("moduleinput");
      octaveTuning.type = "range";
      octaveTuning.min = "-2";
      octaveTuning.max = "2";
      octaveTuning.value = "0";
      octaveTuning.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Synth", "octavetuning", i, event.currentTarget.value);});
      
      const halfStepTuning = document.createElement("input");
      halfStepTuning.classList.add("moduleinput");
      halfStepTuning.type = "range";
      halfStepTuning.min = "-12";
      halfStepTuning.max = "12";
      halfStepTuning.value = "0";
      halfStepTuning.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Synth", "halfsteptuning", i, event.currentTarget.value);});
      
      const fineTuning = document.createElement("input");
      fineTuning.classList.add("moduleinput");
      fineTuning.type = "range";
      fineTuning.min = "-50";
      fineTuning.max = "50";
      fineTuning.value = "0";
      fineTuning.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Synth", "finetuning", i, event.currentTarget.value);});
      
      const voices = document.createElement("input");
      voices.classList.add("moduleinput");
      voices.type = "range";
      voices.min = "1";
      voices.max = "12";
      voices.value = "4";
      voices.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Synth", "voices", i, event.currentTarget.value);});

      const volume = document.createElement("input");
      volume.classList.add("moduleinput");
      volume.type = "range";
      volume.min = "0";
      volume.max = "100";
      volume.value = "50";
      volume.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Synth", "volume", i, event.currentTarget.value);});

      
      const waveformLabel = document.createElement("label");
      const octaveTuningLabel = document.createElement("label");
      const halfStepTuningLabel = document.createElement("label");
      const fineTuningLabel = document.createElement("label");
      const voicesLabel = document.createElement("label");
      const volumeLabel = document.createElement("label");

      waveformLabel.classList.add("modulesliderlabel");
      octaveTuningLabel.classList.add("modulesliderlabel");
      halfStepTuningLabel.classList.add("modulesliderlabel");
      fineTuningLabel.classList.add("modulesliderlabel");
      voicesLabel.classList.add("modulesliderlabel");
      volumeLabel.classList.add("modulesliderlabel");

      waveformLabel.innerText = "Waveform";
      octaveTuningLabel.innerText = "Octave Tuning";
      halfStepTuningLabel.innerText = "Half Step Tuning";
      fineTuningLabel.innerText = "Fine Tuning";
      voicesLabel.innerText = "Voices";
      volumeLabel.innerText = "Volume";

      waveformLabel.htmlFor = waveform.id;
      octaveTuningLabel.htmlFor = octaveTuning.id;
      halfStepTuningLabel.htmlFor = halfStepTuning.id;
      fineTuningLabel.htmlFor = fineTuning.id;
      voicesLabel.htmlFor = voices.id;
      volumeLabel.htmlFor = volume.id;
      
      waveformContainer.appendChild(waveformLabel);
      waveformContainer.appendChild(waveform);
      octaveTuningContainer.appendChild(octaveTuningLabel);
      octaveTuningContainer.appendChild(octaveTuning);
      halfStepTuningContainer.appendChild(halfStepTuningLabel);
      halfStepTuningContainer.appendChild(halfStepTuning);
      fineTuningContainer.appendChild(fineTuningLabel);
      fineTuningContainer.appendChild(fineTuning);
      voicesContainer.appendChild(voicesLabel);
      voicesContainer.appendChild(voices);
      volumeContainer.appendChild(volumeLabel);
      volumeContainer.appendChild(volume);
      
      oscillator.appendChild(waveformContainer);
      oscillator.appendChild(octaveTuningContainer);
      oscillator.appendChild(halfStepTuningContainer);
      oscillator.appendChild(fineTuningContainer);
      oscillator.appendChild(voicesContainer);
      oscillator.appendChild(volumeContainer);
      
      module.appendChild(oscillator);
    }
    const attackContainer = document.createElement("div");
    const decayContainer = document.createElement("div");
    const sustainContainer = document.createElement("div");
    const releaseContainer = document.createElement("div");
    
    attackContainer.classList.add("moduleinputandsliderlabel");
    decayContainer.classList.add("moduleinputandsliderlabel");
    sustainContainer.classList.add("moduleinputandsliderlabel");
    releaseContainer.classList.add("moduleinputandsliderlabel");
    
    const attack = document.createElement("input");
    attack.classList.add("moduleinput");
    attack.id = "moduleinput" + moduleId;
    attack.type = "range";
    attack.min = "0";
    attack.max = "100";
    attack.value = "50";
    attack.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "attack", null, event.currentTarget.value);});

    const decay = document.createElement("input");
    decay.classList.add("moduleinput");
    decay.id = "moduleinput" + moduleId;
    decay.type = "range";
    decay.min = "0";
    decay.max = "100";
    decay.value = "50";
    decay.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument;", "decay", null, event.currentTarget.value);});

    const sustain = document.createElement("input");
    sustain.classList.add("moduleinput");
    sustain.id = "moduleinput" + moduleId;
    sustain.type = "range";
    sustain.min = "0";
    sustain.max = "100";
    sustain.value = "50";
    sustain.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "sustain", null, event.currentTarget.value);});

    const release = document.createElement("input");
    release.classList.add("moduleinput");
    release.id = "moduleinput" + moduleId;
    release.type = "range";
    release.min = "0";
    release.max = "100";
    release.value = "50";
    release.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "release", null, event.currentTarget.value);});


    
    const attackLabel = document.createElement("label");
    const decayLabel = document.createElement("label");
    const sustainLabel = document.createElement("label");
    const releaseLabel = document.createElement("label");
    
    attackLabel.classList.add("modulesliderlabel");
    decayLabel.classList.add("modulesliderlabel");
    sustainLabel.classList.add("modulesliderlabel");
    releaseLabel.classList.add("modulesliderlabel");
    
    attackLabel.innerText = "Attack";
    decayLabel.innerText = "Decay";
    sustainLabel.innerText = "Release";
    releaseLabel.innerText = "Sustain";

    attackLabel.htmlFor = attack.id;
    decayLabel.htmlFor = decay.id;
    sustainLabel.htmlFor = sustain.id;
    releaseLabel.htmlFor = release.id;
    
    
    
    attackContainer.appendChild(attackLabel);
    attackContainer.appendChild(attack);
    decayContainer.appendChild(decayLabel);
    decayContainer.appendChild(decay);
    sustainContainer.appendChild(sustainLabel);
    sustainContainer.appendChild(sustain);
    releaseContainer.appendChild(releaseLabel);
    releaseContainer.appendChild(release);
    
    module.appendChild(attackContainer);
    module.appendChild(decayContainer);
    module.appendChild(sustainContainer);
    module.appendChild(releaseContainer);

  } else if (moduleType == "Drum") {
    const attackContainer = document.createElement("div");
    const decayContainer = document.createElement("div");
    const sustainContainer = document.createElement("div");
    const releaseContainer = document.createElement("div");
    
    attackContainer.classList.add("moduleinputandsliderlabel");
    decayContainer.classList.add("moduleinputandsliderlabel");
    sustainContainer.classList.add("moduleinputandsliderlabel");
    releaseContainer.classList.add("moduleinputandsliderlabel");
    
    const trackColor = color;
    const attack = document.createElement("input");
    attack.classList.add("moduleinput");
    attack.id = "moduleinput" + moduleId;
    attack.type = "range";
    attack.min = "0";
    attack.max = "100";
    attack.value = "50";
    attack.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "attack", null, event.currentTarget.value);});

    const decay = document.createElement("input");
    decay.classList.add("moduleinput");
    decay.id = "moduleinput" + moduleId;
    decay.type = "range";
    decay.min = "0";
    decay.max = "100";
    decay.value = "50";
    decay.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument;", "decay", null, event.currentTarget.value);});

    const sustain = document.createElement("input");
    sustain.classList.add("moduleinput");
    sustain.id = "moduleinput" + moduleId;
    sustain.type = "range";
    sustain.min = "0";
    sustain.max = "100";
    sustain.value = "50";
    sustain.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "sustain", null, event.currentTarget.value);});

    const release = document.createElement("input");
    release.classList.add("moduleinput");
    release.id = "moduleinput" + moduleId;
    release.type = "range";
    release.min = "0";
    release.max = "100";
    release.value = "50";
    release.addEventListener("input", (event) => {audioContextRouting.findModuleChangeParameter(trackColor, moduleId, "Instrument", "release", null, event.currentTarget.value);});


    
    const attackLabel = document.createElement("label");
    const decayLabel = document.createElement("label");
    const sustainLabel = document.createElement("label");
    const releaseLabel = document.createElement("label");
    
    attackLabel.classList.add("modulesliderlabel");
    decayLabel.classList.add("modulesliderlabel");
    sustainLabel.classList.add("modulesliderlabel");
    releaseLabel.classList.add("modulesliderlabel");
    
    attackLabel.innerText = "Attack";
    decayLabel.innerText = "Decay";
    sustainLabel.innerText = "Release";
    releaseLabel.innerText = "Sustain";

    attackLabel.htmlFor = attack.id;
    decayLabel.htmlFor = decay.id;
    sustainLabel.htmlFor = sustain.id;
    releaseLabel.htmlFor = release.id;
    
    
    
    attackContainer.appendChild(attackLabel);
    attackContainer.appendChild(attack);
    decayContainer.appendChild(decayLabel);
    decayContainer.appendChild(decay);
    sustainContainer.appendChild(sustainLabel);
    sustainContainer.appendChild(sustain);
    releaseContainer.appendChild(releaseLabel);
    releaseContainer.appendChild(release);
    
    module.appendChild(attackContainer);
    module.appendChild(decayContainer);
    module.appendChild(sustainContainer);
    module.appendChild(releaseContainer);
    
  } else {
    console.log("setup additional module");
  }
  
  
  moduleInterface.append(module);
  
  const moduleBasic = document.getElementById(moduleId);
  moduleBasic.addEventListener("click", (event) => {
    const modules = document.getElementsByClassName("modulefull");
    for (let i = 0; i < modules.length; ++i) {
      if ((modules[i].parentElement.id.substring(modules[i].parentElement.id.length - 7, modules[i].parentElement.id.length)) == (moduleBasic.parentElement.id.substring(moduleBasic.parentElement.id.length - 7, moduleBasic.parentElement.id.length))) {
        modules[i].classList.add("hidden");
      }
    }
    module.classList.remove("hidden");
  });
  
  const modules = document.getElementsByClassName("modulefull");
  for (let i = 0; i < modules.length; ++i) {
    if ((modules[i].parentElement.id.substring(modules[i].parentElement.id.length - 7, modules[i].parentElement.id.length)) == (moduleBasic.parentElement.id.substring(moduleBasic.parentElement.id.length - 7, moduleBasic.parentElement.id.length))) {
      modules[i].classList.add("hidden");
    }
  }
  module.classList.remove("hidden");
  
  if ((moduleInterface.children.length > 1) && (moduleInterface.children[0].classList.contains("chainmessage2"))) {
    moduleInterface.children[0].remove();
  }
  

} 




function AddMidiKeyboard() {
  const midiKeyboard = document.createElement("div");
  midiKeyboard.classList.add("midikeyboard");
  midiKeyboard.id = "midikeyboard" + currentColor;
  
  
  const QWERTYcontrols = document.createElement("div");
  QWERTYcontrols.classList.add("QWERTYcontrols");
  QWERTYcontrols.id = "QWERTYcontrols" + currentColor;
  
  const useQWERTY = document.createElement("div");
  useQWERTY.classList.add("useQWERTY");
  useQWERTY.id = "useQWERTY" + currentColor;
  useQWERTY.innerText = "Use";
  
  const minusQWERTYStart = document.createElement("div");
  minusQWERTYStart.classList.add("minusQWERTYstart");
  minusQWERTYStart.id = "minusQWERTYstart" + currentColor;
  minusQWERTYStart.innerText = "-";
  
  const plusQWERTYStart = document.createElement("div");
  plusQWERTYStart.classList.add("plusQWERTYstart");
  plusQWERTYStart.id = "plusQWERTYstart" + currentColor;
  plusQWERTYStart.innerText = "+";
  
  minusQWERTYStart.addEventListener("click", (event) => {
    ChangeKeyboardQWERTYStart("minus");
  });
  
  plusQWERTYStart.addEventListener("click", (event) => {
    ChangeKeyboardQWERTYStart("plus");
  });
  
  useQWERTY.addEventListener("click", (event) => {
    ActiveQWERTYTrackColor = useQWERTY.id.substring(useQWERTY.id.length - 7);
    const useQWERTYbuttons = document.getElementsByClassName("useQWERTY");
    for (let i = 0; i < useQWERTYbuttons.length; ++i) {
      if (useQWERTYbuttons[i].id ==  useQWERTY.id) {
        useQWERTYbuttons[i].classList.add("useQWERTYactive");
      } else {
        useQWERTYbuttons[i].classList.remove("useQWERTYactive");
      }
    }
  });
  
  
  QWERTYcontrols.appendChild(useQWERTY);
  QWERTYcontrols.appendChild(plusQWERTYStart);
  QWERTYcontrols.appendChild(minusQWERTYStart);
  
  

  const trackBottomLeft = document.getElementById("trackbottomleft" + currentColor);

  trackBottomLeft.appendChild(midiKeyboard);
  trackBottomLeft.appendChild(QWERTYcontrols);
  
  for (let i = 1; i <= 52; ++i) {
    const midiWhiteKey = document.createElement("div");
    midiWhiteKey.classList.add("midiwhitekey");
    midiWhiteKey.id = "midiwhitekey" + i.toString() + currentColor;
    midiWhiteKey.title = GetKeyNumberFromWhiteKeyNumber(i, "white");
    
    if ((i >= QWERTYStartPosition) && (i <= QWERTYStartPosition + 11)) {
      const QWERTYstring = "QWERTYUIOP[]";
      const midiWhiteKeyText = document.createElement("span");
      midiWhiteKeyText.classList.add("keylabel");
      midiWhiteKeyText.innerText = QWERTYstring[i - QWERTYStartPosition];
      midiWhiteKey.appendChild(midiWhiteKeyText); 
    }

    
    midiKeyboard.appendChild(midiWhiteKey);
    
    const color = currentColor;
    midiWhiteKey.addEventListener("mousedown", function(e){
      if ((midiWhiteKey !== e.target) && !(e.target.classList.contains("keylabel"))) return; 
      PlayKey(color, midiWhiteKey.title, 0);
      midiWhiteKey.classList.add("midikeyactive");
    });
    
    midiWhiteKey.addEventListener("mouseup", function(e){
      if ((midiWhiteKey !== e.target) && !(e.target.classList.contains("keylabel"))) return; 
      midiWhiteKey.classList.remove("midikeyactive");
    });
    
    document.addEventListener("mouseup", function(e){
      midiWhiteKey.classList.remove("midikeyactive");
    });
    
    midiWhiteKey.addEventListener("mouseover", function(e){
      if ((midiWhiteKey !== e.target) && !(e.target.classList.contains("keylabel"))) return; 
      midiWhiteKey.classList.add("midikeyhover");
    });
    
    midiWhiteKey.addEventListener("mouseout", function(e){
      if ((midiWhiteKey !== e.target) && !(e.target.classList.contains("keylabel"))) return; 
      midiWhiteKey.classList.remove("midikeyhover");
    });
    
    
  }
  
  for (let i = 1; i <= 52; ++i) {
    const midiBlackKeyLeft = document.createElement("div");
    midiBlackKeyLeft.classList.add("midiblackkeyleft");
    midiBlackKeyLeft.id = "midiblackkeyleft" + i.toString() + currentColor;
    midiBlackKeyLeft.title = GetKeyNumberFromWhiteKeyNumber(i, "black");
    
    const midiBlackKeyRight = document.createElement("div");
    midiBlackKeyRight.classList.add("midiblackkeyright");
    midiBlackKeyRight.id = "midiblackkeyright" + i.toString() + currentColor;
    midiBlackKeyRight.title = GetKeyNumberFromWhiteKeyNumber(i, "black");
    
    if (i != 52) {
      switch ((i - 1) % 7) {
        case 0:
        case 2:
        case 3:
        case 5:
        case 6:
          const midiWhiteKeyFirst = document.getElementById("midiwhitekey" + i.toString() + currentColor);
          const midiWhiteKeySecond = document.getElementById("midiwhitekey" + (i + 1).toString() + currentColor);
          midiWhiteKeyFirst.appendChild(midiBlackKeyLeft);
          midiWhiteKeySecond.appendChild(midiBlackKeyRight);
          break;
        case 1:
        case 4:
          break;
      }
    }
    
    const color = currentColor;
    midiBlackKeyLeft.addEventListener("mousedown", event => {PlayKey(color, midiBlackKeyLeft.title, 0); });
    midiBlackKeyRight.addEventListener("mousedown", event => {PlayKey(color, midiBlackKeyRight.title, 0); });
    
  }

}

function GetKeyNumberFromWhiteKeyNumber(i, color) {
  
  var octavesUp = Math.floor((i - 1) / 7) * 5;
  var blackKeysBefore = 0;
  switch ((i - 1) % 7) {
    case 0:
      blackKeysBefore = blackKeysBefore + 1;
      break;
    case 1:
    case 2:
      blackKeysBefore = blackKeysBefore + 2;
      break;
    case 3:
      blackKeysBefore = blackKeysBefore + 3;
      break;
    case 4:
    case 5:
      blackKeysBefore = blackKeysBefore + 4;
      break;
    case 6:
      blackKeysBefore = blackKeysBefore + 5;
      break;
  }
  const whiteResult = i + octavesUp + blackKeysBefore - 1;
  const blackResult = whiteResult + 1;
  
  if (color == "white") {
    return whiteResult;

  } else {
    return blackResult;
  }
}

function ChangeKeyboardQWERTYStart(direction) {
  if ((direction == "plus") && (QWERTYStartPosition < 41)) {
    ++QWERTYStartPosition;
  } else if ((direction == "minus") && (QWERTYStartPosition > 1)) {
    --QWERTYStartPosition;
  } else {
    console.log("did not increase/decrease");
  }
  
  const QWERTYpluses = document.getElementsByClassName("plusQWERTYstart");
  const QWERTYminuses = document.getElementsByClassName("minusQWERTYstart");
  if (QWERTYStartPosition == 1) {
    for (let i = 0; i < QWERTYminuses.length; ++i) {
      QWERTYminuses[i].style.opacity = 0.5;
    }
    
  } else if (QWERTYStartPosition == 41) {
    for (let i = 0; i < QWERTYpluses.length; ++i) {
      QWERTYpluses[i].style.opacity = 0.5;
    }
  } else {
    for (let i = 0; i < QWERTYminuses.length; ++i) {
      QWERTYpluses[i].style.opacity = 1;
      QWERTYminuses[i].style.opacity = 1;
    }

  }
  
  RenderQWERTY();
}

function RenderQWERTY() {
  
  const keyLabels = document.getElementsByClassName("keylabel");
  for (let i = keyLabels.length; i > 0; --i) {
    keyLabels[i - 1].remove();
  }
  
  const whiteKeys = document.getElementsByClassName("midiwhitekey");
  for (let i = 1; i <= whiteKeys.length; ++i) {
    const imodulo52 = (((i - 1) % 52) + 1); // 1 through 52
    if ((imodulo52 >= QWERTYStartPosition) && (imodulo52 <= QWERTYStartPosition + 11)) {
      const QWERTYstring = "QWERTYUIOP[]";
      const midiWhiteKeyText = document.createElement("span");
      midiWhiteKeyText.classList.add("keylabel");
      midiWhiteKeyText.innerText = QWERTYstring[imodulo52 - QWERTYStartPosition];
      whiteKeys[i - 1].appendChild(midiWhiteKeyText); 
    }
    
  }
  
  
  
  
  
}
  
  
function PlayKey(color, key, time) { 

  
  if ((recording) && (color == armedTrack)) {
    let timeInTrack = audioContext.currentTime - referenceTime;
    let recordedNote = {trackColor: color, trackType: "Instrument", keyOrPad: key, time: timeInTrack};

    
    recordedNotes.push(recordedNote);
    PlotNoteOnClipFields(recordedNote);
    //sort note 1 after note 2 based on the time.
    recordedNotes.sort((note1, note2) => { if (note1.time < note2.time) {return -1;} else {return 1;} });

    
  }

  const trackRouting = audioContextRouting.getTrackRoutingByColor(color);

  trackRouting.playKey(key, time);

}

function AddChordMap() {

  const chordMapTitle = document.createElement("div");
  chordMapTitle.classList.add("chordmaptitle");
  chordMapTitle.id = "chordmaptitle" + currentColor;
  chordMapTitle.innerText = "Chords";
  
  const chordMap = document.createElement("div");
  chordMap.classList.add("chordmap");
  chordMap.id = "chordmap" + currentColor;
  
  for (let i = 0; i < 72; ++i) {
    const chordPad = document.createElement("div");
    chordPad.classList.add("chordpad");
    chordPad.id = "chordpad" + (i+1).toString() + currentColor;
    chordPad.title = (i+1).toString();
    chordMap.appendChild(chordPad);

    const color = currentColor;
    chordPad.addEventListener("mousedown", function(e){PlayChordPad(color, chordPad.title);});
  }
  
  const chordMapControls = document.createElement("div");
  chordMapControls.classList.add("chordmapcontrols");
  chordMapControls.id = "chordmapcontrols" + currentColor;
  
  const minusOctave = document.createElement("div");
  minusOctave.classList.add("chordmapminus");
  minusOctave.id = "chordmapminus" + currentColor;
  minusOctave.innerText = "-";
  
  const plusOctave = document.createElement("div");
  plusOctave.classList.add("chordmapplus");
  plusOctave.id = "chordmapplus" + currentColor;
  plusOctave.innerText = "+";
  
  minusOctave.addEventListener("click", (event) => {
    ChangeChordMapOctave("minus");
  });
  
  plusOctave.addEventListener("click", (event) => {
    ChangeChordMapOctave("plus");
  });
  
  chordMapControls.appendChild(minusOctave);
  chordMapControls.appendChild(plusOctave);
  
  const trackRight = document.getElementById("trackright" + currentColor);
  trackRight.appendChild(chordMapTitle);
  trackRight.appendChild(chordMap);
  trackRight.appendChild(chordMapControls);
  
}

function PlayChordPad(color, pad) {
  
  //create chords based on half steps
  const major = new Array(0, 4, 7);
  const minor = new Array(0, 3, 7);
  const major7 = new Array(0, 4, 7, 11);
  const minor7 = new Array(0, 3, 7, 10);
  const dom7 = new Array(0, 4, 7, 10);
  const minormajor7 = new Array(0, 3, 7, 11);
  // const major9 = new Array(0, 4, 7, 11, 14);
  // const minor9 = new Array(0, 3, 7, 10, 14);
  // const sus2 = new Array(0, 2, 7);
  // const sus4 = new Array(0, 5, 7);
  
  const chordTypes = new Array();
  chordTypes.push(major, minor, major7, minor7, dom7, minormajor7);

  //find which chord type and chord key to use
  const padAsNumber = parseInt(pad);
  const chordType = ((padAsNumber - 1) % 6); //gives 0 through 5 for accesing chordTypes
  const chordKey = Math.floor((padAsNumber - 1) / 6); // gives 0 through 11 for accesing key to increment by.
  
  for (let i = 0; i < chordTypes[chordType].length; ++i) {
    PlayKey(color, (40 + chordTypes[chordType][i] + chordKey + (chordMapsOctave * 12)).toString(), 0);

  }
  
}

  
function ChangeChordMapOctave(direction) {
  if ((direction == "plus") && (chordMapsOctave < 2)) {
    ++chordMapsOctave;
  } else if ((direction == "minus") && (chordMapsOctave > -3)) {
    --chordMapsOctave;
  } else {
    console.log("did not increase/decrease");
  }
    
  const chordMapPlus = document.getElementsByClassName("chordmapplus");
  const chordMapMinus = document.getElementsByClassName("chordmapminus");
  if (chordMapsOctave == -3) {
    for (let i = 0; i < chordMapMinus.length; ++i) {
      chordMapMinus[i].style.opacity = 0.5;
    }
    
  } else if (chordMapsOctave == 2) {
    for (let i = 0; i < chordMapPlus.length; ++i) {
      chordMapPlus[i].style.opacity = 0.5;
    }
  } else {
    for (let i = 0; i < chordMapMinus.length; ++i) {
      chordMapPlus[i].style.opacity = 1;
      chordMapMinus[i].style.opacity = 1;
    }

  }
  
}
  


function AddDrumTrack() {
  
  AddTrackToAudioContextRouting();
  
  CreateDefaultTrackContents();
  AddDrumTabs();
  
  AddDrumAndEffectsArea();
  AddDrumChainQueue();
  AddDrumChains();
  AddDrumTrackEffectsChain();
  
  AddClipEditor();
  
  AddDrumMachine();
  
  return;
}
  
function AddDrumAndEffectsArea() {
  const drumAndEffectsArea = document.createElement("div");
  drumAndEffectsArea.classList.add("drumandeffectsarea");
  drumAndEffectsArea.classList.add("hidden");
  drumAndEffectsArea.id = "drumandeffectsarea" + currentColor;
  
  const drumAndEffectsQueues = document.createElement("div");
  drumAndEffectsQueues.classList.add("drumandeffectsqueues");
  drumAndEffectsQueues.id = "drumandeffectsqueues" + currentColor;
  
  const drumAndEffectsTrash = document.createElement("div");
  drumAndEffectsTrash.classList.add("drumandeffectstrash");
  drumAndEffectsTrash.id = "drumandeffectstrash" + currentColor;
  
  const trashImg = document.createElement("img");
  trashImg.src = "https://cdn.glitch.global/f49d0236-9333-4ce3-a1b3-011399aa6ed4/trash-image-transparent.png?v=1661986329957";
  trashImg.id = "trashimg";

  const moduleInterface = document.createElement("div");
  moduleInterface.classList.add("moduleinterface");
  moduleInterface.id = "moduleinterface" + currentColor;
  
  const moduleInterfaceMessage = document.createElement("span");
  moduleInterfaceMessage.classList.add("chainmessage2");
  moduleInterfaceMessage.innerText = "Module will appear here";
  
  moduleInterface.appendChild(moduleInterfaceMessage);
  
  drumAndEffectsTrash.appendChild(trashImg);

  drumAndEffectsArea.appendChild(drumAndEffectsQueues);
  drumAndEffectsArea.appendChild(drumAndEffectsTrash);
  drumAndEffectsArea.appendChild(moduleInterface);
  
  MakeDroppable(drumAndEffectsTrash);

  const tabContentsContainer = document.getElementById("tabcontentscontainer" + currentColor);
  tabContentsContainer.appendChild(drumAndEffectsArea);

}
  
function AddDrumTabs() {
  
  const tabContainer = document.createElement("div");
  
  const mainTab = document.createElement("div");
  const drumsAndEffectsTab = document.createElement("div");
  const clipEditorTab = document.createElement("div");
  
  tabContainer.classList.add("tabcontainer");
  
  mainTab.classList.add("tab");
  drumsAndEffectsTab.classList.add("tab");
  clipEditorTab.classList.add("tab");
  
  mainTab.innerText = "Play and Record";
  drumsAndEffectsTab.innerText = "Track Loadout";
  clipEditorTab.innerText = "Clip Editor";
  
  mainTab.classList.add("tabopened");
  
  const color = currentColor;
  mainTab.addEventListener("click", function() {
    const trackContent = document.getElementById("trackcontent" + color);
    const drumAndEffectsArea = document.getElementById("drumandeffectsarea" + color);
    const clipEditor = document.getElementById("clipeditor" + color);
    trackContent.classList.remove("hidden");
    drumAndEffectsArea.classList.add("hidden");
    clipEditor.classList.add("hidden");
    
    mainTab.classList.add("tabopened");
    drumsAndEffectsTab.classList.remove("tabopened");
    clipEditorTab.classList.remove("tabopened");
  });
  
  drumsAndEffectsTab.addEventListener("click", function() {
    const trackContent = document.getElementById("trackcontent" + color);
    const drumAndEffectsArea = document.getElementById("drumandeffectsarea" + color);
    const clipEditor = document.getElementById("clipeditor" + color);
    trackContent.classList.add("hidden");
    drumAndEffectsArea.classList.remove("hidden");
    clipEditor.classList.add("hidden");
    
    mainTab.classList.remove("tabopened");
    drumsAndEffectsTab.classList.add("tabopened");
    clipEditorTab.classList.remove("tabopened");
  });
  
  clipEditorTab.addEventListener("click", function() {
    const trackContent = document.getElementById("trackcontent" + color);
    const drumAndEffectsArea = document.getElementById("drumandeffectsarea" + color);
    const clipEditor = document.getElementById("clipeditor" + color);
    trackContent.classList.add("hidden");
    drumAndEffectsArea.classList.add("hidden");
    clipEditor.classList.remove("hidden");
    
    mainTab.classList.remove("tabopened");
    drumsAndEffectsTab.classList.remove("tabopened");
    clipEditorTab.classList.add("tabopened");
  });
  
  tabContainer.appendChild(mainTab);
  tabContainer.appendChild(drumsAndEffectsTab);
  tabContainer.appendChild(clipEditorTab);
  
  const trackTabsAndContentContainer = document.getElementById("tracktabsandcontent" + currentColor);
  const tabContentsContainer = document.getElementById("tabcontentscontainer" + currentColor);
  trackTabsAndContentContainer.insertBefore(tabContainer, tabContentsContainer);

}

function AddDrumChainQueue() {
  const drumChainQueue = document.createElement("div");
  drumChainQueue.classList.add("drumchainqueue");
  drumChainQueue.id = "drumchainqueue" + currentColor;
  
  const miniDrumMachine = document.createElement("div");
  miniDrumMachine.classList.add("minidrummachine");
  miniDrumMachine.id = "minidrummachine" + currentColor;
  
  for (let i = 0; i < 16; ++i) {
      const miniDrumPad = document.createElement("div");
      miniDrumPad.classList.add("minidrumpad");
      miniDrumPad.id = "minidrumpad" + (i+1).toString() + currentColor;
      miniDrumPad.title = (i+1).toString();
      miniDrumMachine.appendChild(miniDrumPad);
      
      const color = currentColor;
      miniDrumPad.addEventListener("mousedown", function(e){
        PlayPad(color, miniDrumPad.title, 0);
        const drumchainVisible = document.getElementById("drumchain" + (i+1).toString() + color);
        for (let j = 0; j < drumchainVisible.parentElement.children.length; ++j) {
          drumchainVisible.parentElement.children[j].classList.add("hidden");
        }
        drumchainVisible.classList.remove("hidden");
      });
    
  }
  
  const drumQueues = document.createElement("div");
  drumQueues.classList.add("drumqueues");
  drumQueues.id = "drumqueues" + currentColor;
  
  drumChainQueue.appendChild(miniDrumMachine);
  drumChainQueue.appendChild(drumQueues);
  
  const drumsAndEffectsQueues = document.getElementById("drumandeffectsqueues" + currentColor);
  drumsAndEffectsQueues.appendChild(drumChainQueue);
}


function AddDrumChains() {
  for (let i = 1; i <= 16; ++i) {
    const drumChain = document.createElement("div");
    drumChain.classList.add("drumchain");
    drumChain.classList.add("hidden");
    drumChain.id = "drumchain" + i.toString() + currentColor;

    const chainRouting = new ChainRouting(currentColor, i);
    audioContextRouting.getTrackRoutingByColor(currentColor).chainRoutings.push(chainRouting);
    
    const drumChainControls = document.createElement("div");
    drumChainControls.classList.add("drumchaincontrols");
    drumChainControls.id = "drumchaincontrols" + i.toString() + currentColor;
    
    const chainControlsSliders = document.createElement("div");
    const chainControlsButtons = document.createElement("div");
    chainControlsSliders.classList.add("chaincontrolssliders");
    chainControlsButtons.classList.add("chaincontrolsbuttons");
    chainControlsSliders.id = "chaincontrolssliders" + currentColor;
    chainControlsButtons.id = "chaincontrolsbuttons" + currentColor;
 

    const volume = document.createElement("div");
    const panning = document.createElement("div");
    const stereo = document.createElement("div");
    const mute = document.createElement("div");
    const solo = document.createElement("div");

    volume.classList.add("volume");
    panning.classList.add("panning");
    stereo.classList.add("stereo");
    mute.classList.add("mute");
    solo.classList.add("solo");

    volume.id = "volume" + drumChain.id;
    panning.id = "panning" + drumChain.id;
    stereo.id = "stereo" + drumChain.id;
    mute.id = "mute" + drumChain.id;
    solo.id = "solo" + drumChain.id;
    
    volume.classList.add("chainvolume");
    panning.classList.add("chainpanning");
    stereo.classList.add("chainstereo");
    mute.classList.add("chainmute");
    solo.classList.add("chainsolo");

    mute.innerText = "Mute";
    solo.innerText = "Solo";

    const volumeInput = document.createElement("input");
    const panningInput = document.createElement("input");
    const stereoInput = document.createElement("input");

    volumeInput.classList.add("volumeinput");
    panningInput.classList.add("panninginput");
    stereoInput.classList.add("stereoinput");
    
    volumeInput.classList.add("chainvolumeinput");
    panningInput.classList.add("chainpanninginput");
    stereoInput.classList.add("chainstereoinput");

    volumeInput.id = "volumeinput" + drumChain.id;
    panningInput.id = "panninginput" + drumChain.id;
    stereoInput.id = "stereoinput" + drumChain.id;

    volumeInput.type = "range";
    panningInput.type = "range";
    stereoInput.type = "range";

    volumeInput.min = "-100";
    panningInput.min = "-100";
    stereoInput.min = "0";

    volumeInput.max = "100";
    panningInput.max = "100";
    stereoInput.max = "100";

    volumeInput.value = "0";
    panningInput.value = "0";
    stereoInput.value = "0";

    const volumeInputLabel = document.createElement("label");
    const panningInputLabel = document.createElement("label");
    const stereoInputLabel = document.createElement("label");

    volumeInputLabel.htmlFor = "volumeinput" + currentColor;
    panningInputLabel.htmlFor = "panninginput" + currentColor;
    stereoInputLabel.htmlFor = "stereoinput" + currentColor;

    volumeInputLabel.classList.add("chainsliderlabel");
    panningInputLabel.classList.add("chainsliderlabel");
    stereoInputLabel.classList.add("chainsliderlabel");

    volumeInputLabel.innerText = "Vol";
    panningInputLabel.innerText = "Pan";
    stereoInputLabel.innerText = "Stereo";

    volume.appendChild(volumeInputLabel);
    panning.appendChild(panningInputLabel);
    stereo.appendChild(stereoInputLabel);

    volume.appendChild(volumeInput);
    panning.appendChild(panningInput);
    stereo.appendChild(stereoInput); 
    
    const dropDrumsMessage = document.createElement("span");
    dropDrumsMessage.classList.add("chainmessage");
    dropDrumsMessage.innerText = "Drop (1) Drum and Effect(s) here";
    
 
    chainControlsSliders.appendChild(volume);
    chainControlsSliders.appendChild(panning);
    chainControlsSliders.appendChild(stereo);
    chainControlsButtons.appendChild(mute);
    chainControlsButtons.appendChild(solo);
    
    drumChainControls.appendChild(chainControlsSliders);
    drumChainControls.appendChild(chainControlsButtons);

    drumChain.appendChild(drumChainControls);
    drumChain.appendChild(dropDrumsMessage);
    
    MakeDroppable(drumChain);
    
    const drumQueues = document.getElementById("drumqueues" + currentColor);
    drumQueues.appendChild(drumChain);
   
    const color = currentColor;
    volumeInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setGain(event.currentTarget.value);});
    panningInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setPanning(event.currentTarget.value);});
    stereoInput.addEventListener("input", event => {audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setStereo(event.currentTarget.value);});

    volumeInput.addEventListener("dblclick", event => {event.currentTarget.value = 0; audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setGain(event.currentTarget.value);});
    panningInput.addEventListener("dblclick", event => {event.currentTarget.value = 0; audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setPanning(event.currentTarget.value);});
    stereoInput.addEventListener("dblclick", event => {event.currentTarget.value = 0; audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).setStereo(event.currentTarget.value);});
    
    mute.addEventListener("click", event => {
      audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).toggleMute();
      if (mute.classList.contains("muteactive")) {
         mute.classList.remove("muteactive");
      } else {
         mute.classList.add("muteactive");
      }
    });
    solo.addEventListener("click", event => {audioContextRouting.getTrackRoutingByColor(color).getChainRoutingByIndex(i).soloChain(solo);});
  }
}

function AddDrumTrackEffectsChain() {
    const trackEffectsChain = document.createElement("div");
    trackEffectsChain.classList.add("trackeffectschain");
    trackEffectsChain.id = "trackeffectschain" + currentColor;


    const dropTrackEffectsMessage = document.createElement("span");
    dropTrackEffectsMessage.classList.add("chainmessage2");
    dropTrackEffectsMessage.innerText = "Drop Track Effect(s) here";

    trackEffectsChain.appendChild(dropTrackEffectsMessage);


    const drumsAndEffectsQueues = document.getElementById("drumandeffectsqueues" + currentColor);
    drumsAndEffectsQueues.appendChild(trackEffectsChain);

    MakeDroppable(trackEffectsChain);
}

function AddDrumMachine() {
  
  const drumMachineTitle = document.createElement("div");
  drumMachineTitle.classList.add("drummachinetitle");
  drumMachineTitle.id = "drummachinetitle" + currentColor;
  drumMachineTitle.innerText = "Drum Machine";
  
  const drumMachine = document.createElement("div");
  drumMachine.classList.add("drummachine");
  drumMachine.id = "drummachine" + currentColor;
  
  for (let i = 0; i < 16; ++i) {
      const drumPad = document.createElement("div");
      drumPad.classList.add("drumpad");
      drumPad.id = "drumpad" + (i+1).toString() + currentColor;
      drumPad.title = (i+1).toString();
      drumMachine.appendChild(drumPad);
      
      const color = currentColor;
      drumPad.addEventListener("mousedown", function(e){
        PlayPad(color, drumPad.title, 0);
        const drumchainVisible = document.getElementById("drumchain" + (i+1).toString() + color);
        for (let j = 0; j < drumchainVisible.parentElement.children.length; ++j) {
          drumchainVisible.parentElement.children[j].classList.add("hidden");
        }
        drumchainVisible.classList.remove("hidden");
      });
    
    MakeDroppable(drumPad);
  }
  
  const trackRight = document.getElementById("trackright" + currentColor);
  trackRight.appendChild(drumMachineTitle);
  trackRight.appendChild(drumMachine);
}

function PlayPad(color, pad, time) { 

  
  if ((recording) && (color == armedTrack)) {
    let timeInTrack = audioContext.currentTime - referenceTime;
    let recordedNote = {trackColor: color, trackType: "Drum", keyOrPad: pad, time: timeInTrack};

    PlotNoteOnClipFields(recordedNote);
    recordedNotes.push(recordedNote);
    //sort note 1 after note 2 based on the time.
    recordedNotes.sort((note1, note2) => { if (note1.time < note2.time) {return -1;} else {return 1;} });

  }

  const trackRouting = audioContextRouting.getTrackRoutingByColor(color);

  trackRouting.playPad(pad, time);

}






function AddAudioTrack() {
  // CreateDefaultTrackContents();
  
  return;
}






function CreateStaticCursor(barId) {
  const staticCursor = document.createElement("div");
  staticCursor.classList.add("staticcursor");
  staticCursor.id = "staticcursor";
  
  const bar = document.getElementById(barId);
  bar.appendChild(staticCursor);
}

function DeleteStaticCursor() {
  const staticCursor = document.getElementById("staticcursor");
  //this if condition is redundant after implementing default static cursor, it will always be executed.
  if (staticCursor != null) {
    staticCursor.remove();
  }
}

function MoveStaticCursor(barId) {
  DeleteStaticCursor();
  CreateStaticCursor(barId);
}

function CreateMovingCursors() {

  
  var cursorPosition;
  if (createMovingFromStatic) {
    cursorPosition = staticCursorPosition;
  } else {
    cursorPosition = movingCursorPosition;
  }
  
  const bars = document.getElementsByClassName("bar");
  for (let i = 1; i <= bars.length; ++i) {
    if ((i % maxBars) == cursorPosition) {
      const movingCursor = document.createElement("div");
      movingCursor.classList.add("movingcursor");
      movingCursor.id = "movingcursor" + cursorPosition.toString() + bars[i-1].id.substring(bars[i-1].id.length - 7);
      
      const animationSpeed = 4 * (60 / bpm);
      movingCursor.style.animationDuration = animationSpeed.toString() + "s";

      bars[i-1].appendChild(movingCursor);
      movingCursorPosition = cursorPosition;
    }
    if (((i % maxBars == 0)) && (cursorPosition == maxBars)) {
      const movingCursor = document.createElement("div");
      movingCursor.classList.add("movingcursor");
      movingCursor.id = "movingcursor" + cursorPosition.toString() + bars[i-1].id.substring(bars[i-1].id.length - 7);
      
      const animationSpeed = 4 * (60 / bpm);
      movingCursor.style.animationDuration = animationSpeed.toString() + "s";
      
      bars[i-1].appendChild(movingCursor);
      movingCursorPosition = cursorPosition;
    }
  }
  movingCursorsExist = true;
  UpdateTimeAtCursorCreationOrResumePlay();
}

function DeleteMovingCursors() {

  const movingCursors = document.getElementsByClassName("movingcursor");
  for (let i = movingCursors.length; i > 0; --i) {
    movingCursors[i-1].remove();
  }
  movingCursorsExist = false;
  animationEndEventListenerExists = false;
  ResetPartialBarOffsetTime();
}

function Play() {

  if (playbackOn) {
    StopPlayback();
    DeleteMovingCursors();
  }
  if (!(movingCursorsExist)) {
    CreateMovingCursors();
  }
  UpdateTimeAtCursorCreationOrResumePlay();
  CancelQueuedNotes();
  StopRecording();
  StartPlayback();
  PlayRecordedNotes();
}

function Pause() {

  if (playbackOn) {
    StopPlayback();
    UpdatePartialBarOffsetTime();
  }
  CancelQueuedNotes();
  StopRecording();
 
}

function Stop() {

  if (playbackOn) {
    StopPlayback();
    UpdatePartialBarOffsetTime();
  } else if (movingCursorsExist) {
    DeleteMovingCursors();
  }
  CancelQueuedNotes();
  StopRecording();
}

function Record() {

  
  if (!recording) {
    Play();

    recording = true;
    referenceTime = audioContext.currentTime - OffsetTimeByPositionInTrack();
    //TODO: create moving red field for recording areas
  } else {
    Pause();
    Stop();
 
    recording = false;
    //TODO: remove moving red field for recording areas
  }
}

function Loop() {
  leftLoop = null;
  rightLoop = null;
  if ((potentialLeftLoop != null) && (potentialRightLoop != null)) {
    leftLoop = potentialLeftLoop;
    rightLoop = potentialRightLoop;
    
  }
  RenderLoopStyling();
  potentialLeftLoop = null;
  potentialRightLoop = null;
}

function Undo() {
  //TODO: implement UNDO 
}
  
function PlayRecordedNotes() {
  let offset = OffsetTimeByPositionInTrack();
  for (let i = 0; i < recordedNotes.length; ++i) {
    if (recordedNotes[i].time >= offset) {
      if (recordedNotes[i].trackType == "Instrument") {
        PlayKey(recordedNotes[i].trackColor, recordedNotes[i].keyOrPad, recordedNotes[i].time - offset);
      } else if (recordedNotes[i].trackType == "Drum") {
        PlayPad(recordedNotes[i].trackColor, recordedNotes[i].keyOrPad, recordedNotes[i].time - offset);
      } else {
        console.log("error");
      } 
    }

  }
}

function CancelQueuedNotes() {
  for (let i = 0; i < queuedNotesSources.length; ++i) {
    queuedNotesSources[i].stop();
  }
  queuedNotesSources = [];
}

function StopRecording() {
  if (recording) {
    recording = false;
  }
  SetPlottedNotesColorToDefault();
}
  
function UpdateTimeAtCursorCreationOrResumePlay() {
  timeAtCursorCreationOrResumePlay = audioContext.currentTime;
}
  
function UpdatePartialBarOffsetTime() {
  partialBarOffsetTime += audioContext.currentTime - timeAtCursorCreationOrResumePlay;
}
  
function ResetPartialBarOffsetTime() {
  partialBarOffsetTime = 0;
}
  

  


function StartPlayback() {

  StartAnimateMovingCursors();
  

  if (animationEndEventListenerExists == false) {

    const movingCursors = document.getElementsByClassName("movingcursor");
    movingCursors[0].addEventListener("animationend", function() {

      createMovingFromStatic = false;
      DeleteMovingCursors();
      
      let loopFinished = false;
      if (movingCursorPosition == rightLoop) {
        movingCursorPosition = leftLoop;
        loopFinished = true;
      } else {
        movingCursorPosition += 1;
      }

      CreateMovingCursors();
      createMovingFromStatic = true;
      
      
      if (loopFinished) {
        let wasRecording = recording;
        Pause();
        if (wasRecording) {
          Record();
        } else {
          Play();
        }
      }
      
      StartPlayback();
    }, false);

    animationEndEventListenerExists = true;
  }

  playbackOn = true;
}

function StopPlayback() {

  
  StopAnimateMovingCursors();
  
  playbackOn = false;
}

function StartAnimateMovingCursors() {

  const movingCursors = document.getElementsByClassName("movingcursor");
  for (let i = 0; i < movingCursors.length; ++i) {
    movingCursors[i].style.animationPlayState = "running";
  }
}

function StopAnimateMovingCursors() {

  const movingCursors = document.getElementsByClassName("movingcursor");
  for (let i = 0; i < movingCursors.length; ++i) {
    movingCursors[i].style.animationPlayState = "paused";
  }
}
  
function RenderLoopStyling() {
  
    const bars = document.getElementsByClassName("bar");
    for (let i = 0; i < bars.length; ++i) {
      bars[i].classList.remove("barloopstart");
      bars[i].classList.remove("barloopmiddle");
      bars[i].classList.remove("barloopend");
      bars[i].classList.remove("barloopstartend");
      if ((rightLoop != null) && (leftLoop != null)) {
        const barNum = parseInt(bars[i].id.substring(3, bars[i].id.length - 7));
        if ((rightLoop == leftLoop) && (barNum == leftLoop)) {
          bars[i].classList.add("barloopstartend");
        } else if (barNum == leftLoop) {
          bars[i].classList.add("barloopstart");
        } else if ((barNum > leftLoop) && (barNum < rightLoop)) {
          bars[i].classList.add("barloopmiddle");
        } else if (barNum == rightLoop) {
          bars[i].classList.add("barloopend");
        } else {
          //do nothing
        }
      }
    }
 
}
  

function LocateBarAndPositionInBarForPlottingNote(time) {

  let barLengthInTime = (60 / bpm) * 4;
  let bar = Math.floor(time / barLengthInTime) + 1;
  let pos = (time % barLengthInTime) / barLengthInTime;
  let barAndPos = {bar: bar, pos: pos}; // bar is indexed from 1, pos is in [0 - 1) range.
  
  return barAndPos;
}

function PlotNoteOnClipFields(recordedNote) {
  const barAndPos = LocateBarAndPositionInBarForPlottingNote(recordedNote.time);
  const barToPlotIn = document.getElementById("bar" + barAndPos.bar.toString() + recordedNote.trackColor);
  let posFromLeft = Math.floor(barAndPos.pos * 100);
  let posFromTop = recordedNote.keyOrPad;
  if (recordedNote.trackType == "Instrument") {
    posFromTop = (88 - posFromTop) + 6; //6 through 94 
  } else if (recordedNote.trackType == "Drum") {
    posFromTop = ((16 - posFromTop) * 5.5) + 6; // 6 through 94 
  }
  
  const note = document.createElement("div");
  note.classList.add("note");
  note.style.top =  posFromTop.toString() + "%";
  note.style.left = posFromLeft.toString() + "%";
  note.style.backgroundColor = "#C72243"; /* MADDER */

  barToPlotIn.appendChild(note);
}
  
function SetPlottedNotesColorToDefault() {
  const notes = document.getElementsByClassName("note");
  for (let i = 0; i < notes.length; ++i) {
    notes[i].style.backgroundColor = "#44AC44"; /* FOREST GREEN */
  }
}

function AddClipField() {
  
  const clipFieldLocator = document.createElement("div");
  clipFieldLocator.classList.add("clipfieldlocator");
  clipFieldLocator.id = "clipfieldlocator" + currentColor;
  
  const clipFieldHeader = document.createElement("div");
  clipFieldHeader.classList.add("clipfieldheader");
  clipFieldHeader.id = "clipfieldheader" + currentColor;

  const clipField = document.createElement("div");
  clipField.classList.add("clipfield");
  clipField.id = "clipfield" + currentColor;
  
  for (let i = 1; i <= maxBars; i++) {
    const bar = document.createElement("div");
    bar.classList.add("bar");
    bar.id = "bar" + i.toString() + currentColor;
    
    bar.addEventListener("wheel", event => {
      event.preventDefault();
      const delta = Math.sign(event.deltaY);
      ScrollClipField(delta, i);

    });
    
    bar.addEventListener("mousedown", event => {
      event.preventDefault();
      const elementTarget = event.target;
      const elementWidth = elementTarget.offsetWidth;
      const x = event.clientX - elementTarget.getBoundingClientRect().left;
      currentColor = elementTarget.id.substring(elementTarget.id.length - 7);
      if (((elementWidth) / 1.66) > x) {
        MoveStaticCursor(bar.id);
        staticCursorPosition = i;
      } else {
        const nextBarId = "bar" + (i + 1).toString() + currentColor;
        if (i != maxBars) {
          MoveStaticCursor(nextBarId);
          staticCursorPosition = i + 1;
        } else {
          MoveStaticCursor(bar.id);
          staticCursorPosition = i;
        }
      }
    });
    
    bar.addEventListener("mousedown", event => {
      event.preventDefault();
      potentialLeftLoop = i;
    });
    
    bar.addEventListener("mouseup", event => {
      event.preventDefault();
      if (potentialLeftLoop <= i) {
        potentialRightLoop = i;
        RenderLoopStyling();
      } else {
        potentialLeftLoop = null;
        potentialRightLoop = null;
      }
      if (potentialLeftLoop == null) {
        potentialRightLoop = null;
      }
    });
    
    document.addEventListener("mousedown", event => {
      if (!(event.target.classList.contains("bar")) && !(event.target.id == "loop") && !(event.target.id == "loopimg")) {
        potentialLeftLoop = null;
        potentialRightLoop = null;
      }
    });
    
    document.addEventListener("mouseup", event => {
      event.preventDefault();
      if (!(event.target.classList.contains("bar")) && !(event.target.id == "loop") && !(event.target.id == "loopimg")) {
        potentialLeftLoop = null;
        potentialRightLoop = null;
      }
    });
    
    const barNumber = document.createElement("div");
    barNumber.classList.add("barnumber");
    barNumber.id = "barnumber" + i.toString() + currentColor;
    
    barNumber.addEventListener("wheel", event => {
      event.preventDefault();
      const delta = Math.sign(event.deltaY);
      ScrollClipField(delta, i);

    });
    
    const textBarNumber = document.createTextNode(i.toString());
    barNumber.appendChild(textBarNumber);
 
    const barLocator = document.createElement("div");
    barLocator.classList.add("barlocator");
    barLocator.id = "barlocator" + i.toString() + currentColor;
    
    barLocator.addEventListener("wheel", event => {
      event.preventDefault();
      const delta = Math.sign(event.deltaY);
      ScrollClipField(delta, i);

    });
    
    barLocator.addEventListener("mousedown", event => {
      event.preventDefault();
      if ((i >= leftmostVisible) && (i <= rightmostVisible)) {
        barLocatorClicked = i;
        barLocatorLocationFromLeft = (barLocatorClicked - leftmostVisible);
        barLocatorLocationFromRight = (rightmostVisible - barLocatorClicked);
      }
    });
    
    barLocator.addEventListener("mouseover", event => {
      event.preventDefault();
      if ((barLocatorClicked != null) && (i > barLocatorLocationFromLeft) && (i <= (maxBars - barLocatorLocationFromRight))) {
        leftmostVisible = i - barLocatorLocationFromLeft;
        rightmostVisible = i + barLocatorLocationFromRight;
        RenderClipFieldBars();
      }
    });

    document.addEventListener("mouseup", event => {
        event.preventDefault();
        barLocatorClicked = null;
        barLocatorLocationFromLeft = null;
        barLocatorLocationFromRight = null;
    });
    

    
    if ((i % 2) == 0) {
      bar.classList.add("barstyle1");
      barNumber.classList.add("barstyle1");
      barLocator.classList.add("barstyle1");
    } else {
      bar.classList.add("barstyle2");
      barNumber.classList.add("barstyle2");
      barLocator.classList.add("barstyle2");
    }

    clipFieldLocator.append(barLocator);
    clipFieldHeader.appendChild(barNumber);
    clipField.appendChild(bar);
    
  }
  
  const trackClipFieldArea = document.getElementById("trackclipfieldarea" + currentColor);
  trackClipFieldArea.appendChild(clipFieldLocator);
  trackClipFieldArea.appendChild(clipFieldHeader);
  trackClipFieldArea.appendChild(clipField);
  
  RenderClipFieldBars();
  //add first static cursor
  if (totalTracks == 1) {
    const bars = document.getElementsByClassName("bar");
    CreateStaticCursor(bars[0].id);
  }
  
  return;
}


function ScrollClipField(delta, i) {
  if (delta == -1) {
    ScrollInClipField(i);
  } else if (delta == 1){
    ScrollOutClipField(i);
  } else {
    console.log("clip field scroll not working.");
  }
  
  RenderClipFieldBars();
}

function ScrollInClipField(bar) {
  if (currentBars == minBars) {
    return;
  } else {
    currentBars = (currentBars / 2);
    if (((bar - leftmostVisible + 1) % 2) != 0) {
      leftmostVisible = ((bar - (leftmostVisible - 1) + 1) / 2) + (leftmostVisible - 1);
      rightmostVisible = leftmostVisible + (currentBars - 1);
      
    } else {
      leftmostVisible = (((bar - (leftmostVisible - 1)) / 2) + 1) + (leftmostVisible - 1);
      rightmostVisible = leftmostVisible + (currentBars - 1);
    } 
  }
}

function ScrollOutClipField(bar) {
  if (currentBars == maxBars) {
    return;
  } else {
    currentBars = (currentBars * 2);
    if (((bar - leftmostVisible + 1) % 2) != 0) {
      leftmostVisible = 1 - (bar - (leftmostVisible - 1) - 1) + (leftmostVisible - 1);
      rightmostVisible = leftmostVisible + (currentBars - 1);
    } else {
      leftmostVisible = 1 - (bar - (leftmostVisible - 1)) + (leftmostVisible - 1);
      rightmostVisible = leftmostVisible + (currentBars - 1);
    }
    if (leftmostVisible < 1) {
      let shiftup = 1 - leftmostVisible;
      leftmostVisible += shiftup; 
      rightmostVisible += shiftup;
    }
    if (rightmostVisible > maxBars) {
      let shiftdown = rightmostVisible - maxBars;
      leftmostVisible -= shiftdown; 
      rightmostVisible -= shiftdown;
    }
  }
}

function RenderClipFieldBars() {
  
  let smallerFont = "0.8em";
  if ((rightmostVisible - leftmostVisible) > 40) {
    smallerFont = "0.5em";
  } 
  
  //for all bars, render if in visible range.
  const bars = document.getElementsByClassName("bar");
  const barNumbers = document.getElementsByClassName("barnumber");
  const barLocators = document.getElementsByClassName("barlocator");
  for (let i = 1; i <= bars.length; ++i) {
    if ((i % maxBars) == 0){
      if (rightmostVisible == maxBars) {
        bars[i-1].style.width = "100%";
        barNumbers[i-1].style.width = "100%";
        bars[i-1].style.borderWidth = "1px";
        barNumbers[i-1].style.borderWidth = "1px";
        barLocators[i-1].style.backgroundColor = "#4467AA"; /* DENIM+44*/
        barLocators[i-1].style.opacity = 0.8;
      } else {
        bars[i-1].style.width = "0%";
        barNumbers[i-1].style.width = "0%";
        bars[i-1].style.borderWidth = "0px";
        barNumbers[i-1].style.borderWidth = "0px";
        barLocators[i-1].style.backgroundColor = "#99BCFF"; /* DENIM+AA*/
        barLocators[i-1].style.opacity = 0.8;
      }
    } else if (((i % maxBars) >= leftmostVisible) && ((i % maxBars) <= rightmostVisible)){
      bars[i-1].style.width = "100%";
      barNumbers[i-1].style.width = "100%";
      bars[i-1].style.borderWidth = "1px";
      barNumbers[i-1].style.borderWidth = "1px";
      barLocators[i-1].style.backgroundColor = "#4467AA"; /* DENIM+44*/
      barLocators[i-1].style.opacity = 0.8;
      
    } else {
      bars[i-1].style.width = "0%";
      barNumbers[i-1].style.width = "0%";
      bars[i-1].style.borderWidth = "0px";
      barNumbers[i-1].style.borderWidth = "0px";
      barLocators[i-1].style.backgroundColor = "#99BCFF"; /* DENIM+AA*/
      barLocators[i-1].style.opacity = 0.8;
    }

    barNumbers[i-1].style.fontSize = smallerFont;
  }
  
}

})();