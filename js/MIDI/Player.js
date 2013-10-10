/*
	-------------------------------------
	midiPlayer : 0.3
	-------------------------------------
	https://github.com/mudcube/MIDI.js
	-------------------------------------
	#jasmid
	-------------------------------------

*/


function MidiPlayer(){
    //constructor
    //Public Variables
    this.callback = undefined; // your custom callback goes here!
    this.currentTime = 0;
    this.endTime = 0; 
    this.playing = false;
    this.timeWarp = 1;
    this.measures = []; //Measure number: time of measure number;
    this.firstMeasureToBePlayed = 1;
    this.lastMeasureToBePlayed = 1;
    this.MIDIMasterVol = 100; //Master Volume
    this.MIDIOffset = 0; //transpose by this number of semitones;
    this.data = []; //array with linearized midifile

    //Private Variables
    var eventQueue = []; // hold events to be triggered
    var queuedTime; // 
    var startTime = 0; // to measure time elapse
    var noteRegistrar = {}; // get event for requested note
    var onMidiEvent = undefined; // listener callback
    var replayer = {}; //object used to linearize midifile. 
    var self = this;

    var active_channels = [];
    var measure;
    var miliSecondsPerBeat;
    var measureTimeSoFar = 0;
    var beatsPerMeasure;
    var measuresSoFar = 0;
    var firstNoteHasPlayed = false;
    var restart = 0; 


    //Private Methods

    //Schedules callback using javascript setTimeout. 
    //Grabs next batch of notes to schedule after previous batch is done.    
    function scheduleTracking(metronome, channel, note, currentTime, offset, message, velocity ){
        var interval = window.setTimeout(function () {
            var data = {
                metronome: metronome, //Boolean; If i
            channel: channel,
            note: note,
            now: currentTime,
            end: self.endTime,
            message: message,
            velocity: velocity
            };
            //
            if (message === 128) {
                delete noteRegistrar[note];
            } else if (message === 144){
                noteRegistrar[note] = data;
            }
            if (onMidiEvent) { //If there's a callback, do it and send data;
                onMidiEvent(data);
            }
            if(metronome){ return; }

            self.currentTime = currentTime;
            if (self.currentTime === queuedTime && queuedTime <= self.measures[self.lastMeasureToBePlayed]) { // grab next sequence
                startAudio(queuedTime, true);
            }
            if(self.currentTime > self.measures[self.lastMeasureToBePlayed]){
                //If you're at last measure to be played, restart.
                self.stop();
                self.start();
            }	 
        }, currentTime - offset);
        return interval;
    }//End scheduleTracking()

    //Important but I don't really understand this. Or know if it's necessary.
    function getContext(){
        if (MIDI.lang === 'WebAudioAPI') {
            return midiPlayer.ctx;
        } else if (!self.ctx) {
            self.ctx = { currentTime: 0 };
        }
        return self.ctx;
    };

    //gets total time midi file.
    function getLength(){
        var data =  self.data;
        var length = data.length;
        var totalTime = 0.5;
        for (var n = 0; n < length; n++) {
            totalTime += data[n][1];
        }
        return totalTime;
    };


    //creates array of measure times.
    function initMeasures(){
        var data = self.data;
        var length = data.length;
        var miliSecondsPerBeat = null;
        var beatsPerMeasure = null;
        var firstNoteHasPlayed = false; //flag to account for first note.
        var measureLength = 0;
        var eventTimeSoFar = 0; //total Time Up To Current Event;
        var measureTimeSoFar = 0; //total Time For Measures Up to now

        self.measures[1] = 0;

        for(var i = 0; i< length; i++){
            var event = data[i][0].event;
            if( event.type === "meta" && event.subtype === "setTempo"){
                miliSecondsPerBeat = event.microsecondsPerBeat * self.timeWarp / 1000;
                measureLength = miliSecondsPerBeat * beatsPerMeasure;

            }
            else if( event.type === "meta" && event.subtype === "timeSignature"){
                beatsPerMeasure = event.numerator * (4 / event.denominator);	
                measureLength = miliSecondsPerBeat * beatsPerMeasure;
            }
            if(measureLength && !firstNoteHasPlayed){
                firstNoteHasPlayed = true;
                measureTimeSoFar += measureLength;
                self.measures.push(measureTimeSoFar); 	

            }
            if (data[i][1]){
                eventTimeSoFar += data[i][1];
                if(eventTimeSoFar >= measureTimeSoFar){
                    measureTimeSoFar += measureLength;
                    self.measures.push(measureTimeSoFar); 	
                }
            }

        }
        self.lastMeasureToBePlayed = self.measures.length - 1;
        self.firstMeasureToBePlayed = 1;

    }//End initMeasures

    //gets channels that have data
    //active_channel array has program number as value
    //default program is 0
    function getActiveChannels(){
        var data = self.data;
        var length = data.length;

        for(var n = 0; n < length; n++){
            var event = data[n][0].event;
            if (typeof(event.channel) === "number" && 
                    typeof(active_channels[event.channel]) !== "number"){
                if(event.programNumber){		
                    active_channels[event.channel] = event.programNumber;
                }else{
                    active_channels[event.channel] = 0;
                }
            }
        }
    }

    //changes program if program is one of the loaded ones. 
    function initChannelPrograms(){
        for(var n = 0; n < active_channels.length; n++){
            if(active_channels[n] == 0 || active_channels[n] == 6 || active_channels[n] == 74){	
                MIDI.programChange(n,active_channels[n]);
            }
        }

    }

    // runs jasmid's MidiFile and (modified) Replayer with currentData and timeWarp
    // resets and gets active_channels; initializes measures Array
    // helper for self.loadFile()
    function loadMidiFile(){
        replayer = new Replayer(MidiFile(self.currentData), self.timeWarp);
        self.data = replayer.getData();
        self.endTime = getLength();
        self.MIDIOffset = 0;
        active_channels = [];
        self.measures = [];
        getActiveChannels();
        initMeasures();
    }

    //schedules the webAudio start and stop.
    function startAudio (currentTime, fromCache){
        if (!replayer) return;
        if (!fromCache) {
            //fromCache is set when startAudio is called from scheduleTracking.
            if (typeof (currentTime) === "undefined") currentTime = restart;
            if (self.playing) stopAudio();
            self.playing = true;
            self.data = replayer.getData();
            miliSecondsPerBeat = null;
            beatsPerMeasure = null;
            for(var i = 0; i < self.data.length; i++){
                var event = self.data[i][0].event;
                if( event.type === "meta" && event.subtype === "setTempo"){
                    miliSecondsPerBeat = event.microsecondsPerBeat * self.timeWarp / 1000;
                }
                else if( event.type === "meta" && event.subtype === "timeSignature"){
                    beatsPerMeasure = event.numerator * (4 / event.denominator);	
                }
                if(miliSecondsPerBeat && beatsPerMeasure) break; 
            }	
            self.endTime = getLength();
            measure = miliSecondsPerBeat * beatsPerMeasure;
        }

        var queuedTimeOffset = 0.5; //seems to be starting a little in the future. Don't really know why this is here
        var note;
        var offset = 0; // to handle starting later in file.
        var messages = 0; //Chunks to look at;
        var data = self.data;	
        var ctx = getContext();
        var length = data.length;

        queuedTime = queuedTimeOffset; // ??? where in File we are + .5 to give us a little time in the future to play thing. 

        startTime = ctx.currentTime; //Doesn't get used in this function. 


        //loops through data. 
        //only goes up to messages. 
        //Things get messed up if messages is much greater than 100;
        for (var n = 0; n < length && messages < 100; n++) {
            queuedTime += data[n][1];

            if (queuedTime < currentTime) {
                offset = queuedTime;
                continue;
            }

            //where in file we are; accounting for starting in middle. Private Var
            currentTime = queuedTime - offset; 

            //To deal with first note event having time 0
            if(!firstNoteHasPlayed){
                firstNoteHasPlayed = true;	//this is the first note;	
                measuresSoFar++;
                eventQueue.push({
                    source: null,
                    interval:scheduleTracking(measuresSoFar, null, 
                        null, self.measures[measuresSoFar], offset, null, null ),
                }); 
            }

            //schedules measure event. 
            //Meaures happen when next note event to be scheduled is >= next measure to be scheduled. 
            if(queuedTime >= self.measures[measuresSoFar + 1]){
                measuresSoFar++;
                eventQueue.push({
                    source: null,
                    interval:scheduleTracking(measuresSoFar, null, 
                        null, self.measures[measuresSoFar], offset, null, null ),
                }); 

            }

            //scheduling of note events. Deals with Muting and Solo and volume as well.
            var event = data[n][0].event; // current event;

            if (event.type !== "channel") continue; // only care about channel data;
            var channel = event.channel;
            switch (event.subtype) {
                case 'noteOn':
                    //MUTE
                    if (MIDI.channels[channel].mute) break;

                    //SOLO
                    otherSoloFlag = false;
                    if (!MIDI.channels[channel].solo){
                        for(var i = 0; i < 16; i++){
                            if(MIDI.channels[i].solo) {otherSoloFlag = true; break;}
                        }
                    }
                    if(otherSoloFlag) break; 

                    //what's the actual note. Account for Transpose;
                    note = event.noteNumber + (self.MIDIOffset || 0);

                    //what's the velocity; Account for volume change;
                    velocity = Math.ceil(event.velocity * self.MIDIMasterVol / 100);

                    eventQueue.push({
                        event: event,
                        //play note;
                        source: MIDI.noteOn(channel, note, velocity, currentTime / 1000 + ctx.currentTime),
                        //info for callback 
                        interval: scheduleTracking(false, channel, note, queuedTime, offset, 144, velocity )
                    });
                    messages ++; 
                    break;
                case 'noteOff':
                    //MUTE
                    if (MIDI.channels[channel].mute) break;
                    //SOLO
                    otherSoloFlag = false;
                    if (!MIDI.channels[channel].solo){
                        for(var i = 0; i < 16; i++){
                            if(MIDI.channels[i].solo) {otherSoloFlag = true; break;}
                        }
                    }
                    if(otherSoloFlag) break; 
                    //what's the actual note; Accounts for Transpose;
                    note = event.noteNumber + (self.MIDIOffset || 0);

                    eventQueue.push({
                        event: event,
                        //turns off note
                        source: MIDI.noteOff(channel, note, currentTime / 1000 + ctx.currentTime),
                        //schedules when to turn off note
                        interval: scheduleTracking(false, channel, note, queuedTime, offset, 128)
                    });
                    break;
                default:
                    break;
            }
        }//End for loop of scheduling

    }//End startAudio

    //stops audio. Removes scheduled events from eventQueue.
    function stopAudio(){
        var ctx = getContext();
        self.playing = false;
        restart += (ctx.currentTime - startTime) * 1000;
        // stop the audio, and intervals
        while (eventQueue.length) {
            var o = eventQueue.pop();
            window.clearInterval(o.interval);
            if (!o.source) continue; // is not webaudio
            if (typeof(o.source) === "number") {
                window.clearTimeout(o.source);
            } else { // webaudio
                var source = o.source;
                source.disconnect(0);
                source.noteOff(0);
            }
        }
        // run callback to cancel any notes still playing
        for (var key in noteRegistrar) {
            var o = noteRegistrar[key]
                if (noteRegistrar[key].message === 144 && onMidiEvent) {
                    onMidiEvent({
                        channel: o.channel,
                        note: o.note,
                        now: o.now,
                        end: o.end,
                        message: 128,
                        velocity: o.velocity
                    });
                }
        }

        noteRegistrar = {}; // reset noteRegistrar; Don't know what noteRegistrar does.
        measuresSoFar = 0;
        measureTimeSoFar = 0;
        firstNoteHasPlayed = false;
    }//end stopAudio()


    //Priviledged Methods

    this.get_active_channels = function(){
        return active_channels;
    }

    this.start = this.resume = function(){
        if (self.currentTime < -1) self.currentTime = -1;
        startAudio(self.currentTime);
    };

    this.stop = function(){
        stopAudio();
        restart = 0;
        self.currentTime = self.measures[self.firstMeasureToBePlayed]; 
    };

    this.pause = function(){
        var tmp = restart;
        stopAudio();
        restart = tmp;
    };

    this.addListener = function(callback){
        onMidiEvent = callback;
    };

    this.removeListener = function(){
        onMidiEvent = undefined;
    };

    this.loadFile = function(file, init, callback) {
        self.stop();
        if (file.indexOf("base64,") !== -1) {
            var data = window.atob(file.split(",")[1]);
            self.currentData = data;
            loadMidiFile();
            if(init) initChannelPrograms();
            if (callback) callback(data);
            return;
        }
        ///
        var fetch = new XMLHttpRequest();
        fetch.open('GET', file);
        fetch.overrideMimeType("text/plain; charset=x-user-defined");
        fetch.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                var t = this.responseText || "";
                var ff = [];
                var mx = t.length;
                var scc = String.fromCharCode;
                for (var z = 0; z < mx; z++) {
                    ff[z] = scc(t.charCodeAt(z) & 255);
                }
                var data = ff.join("");
                self.currentData = data;
                loadMidiFile();
                if(init) initChannelPrograms();
                if (callback) callback(data);
            }
        };
        fetch.send();
    }; //End loadFile

}



// =========================OLD WAY=========================

if (typeof (MIDI) === "undefined") var MIDI = {};
if (typeof (midiPlayer) === "undefined") midiPlayer = {};

