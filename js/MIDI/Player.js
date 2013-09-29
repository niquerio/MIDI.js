/*
	-------------------------------------
	midiPlayer : 0.3
	-------------------------------------
	https://github.com/mudcube/MIDI.js
	-------------------------------------
	#jasmid
	-------------------------------------

Things to Do:
	Time Changes;
	Tempo Changes;

*/


function MidiPlayer(){
    //constructor
    //Public Variables
    this.callback = undefined; // your custom callback goes here!
    this.currentTime = 0;
    this.endTime = 0; 
    this.restart = 0; 
    this.playing = false;
    this.timeWarp = 1;

    //Private Variables
    var eventQueue = []; // hold events to be triggered
    var queuedTime; // 
    var startTime = 0; // to measure time elapse
    var noteRegistrar = {}; // get event for requested note
    var onMidiEvent = undefined; // listener callback
    var self = this;

    var active_channels = [];
    var measure;
    var miliSecondsPerBeat;
    var measureTimeSoFar = 0;
    var beatsPerMeasure;
    var measuresSoFar = 0;
    var firstNoteFlag = false;
    

//Private Methods
function scheduleTracking(metronome, channel, note, currentTime, offset, message, velocity ){
	var interval = window.setTimeout(function () {
		var data = {
			metronome: metronome, //Boolean
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
		} else {
			noteRegistrar[note] = data;
		}
		if (onMidiEvent) {
			onMidiEvent(data);
		}
        	if(metronome){ 
			return; }
		self.currentTime = currentTime;
		if (self.currentTime === queuedTime && queuedTime < self.endTime) { // grab next sequence
			startAudio(queuedTime, true);
		}
	}, currentTime - offset);
	return interval;
};

function getContext(){
	if (MIDI.lang === 'WebAudioAPI') {
		return midiPlayer.ctx;
	} else if (!self.ctx) {
		self.ctx = { currentTime: 0 };
	}
	return self.ctx;
};

function getLength(){
	var data =  self.data;
	var length = data.length;
	var totalTime = 0.5;
	for (var n = 0; n < length; n++) {
		totalTime += data[n][1];
	}
	return totalTime;
};

function getActiveChannels(){
	var data = self.data;
	var length = data.length;
	
	for(var n = 0; n < length; n++){
		var current_event = data[n][0].event;
		if (typeof(current_event.channel) === "number" && typeof(active_channels[current_event.channel]) !== "number"){
		        if(current_event.programNumber){		
				active_channels[current_event.channel] = current_event.programNumber;
			    }else{
				active_channels[current_event.channel] = null;
			}
	
		}
	}
	
	
}

function initChannelPrograms(){
	for(var n = 0; n < active_channels.length; n++){
		if(typeof(active_channels[n]) === "number" && (active_channels[n] == 0 || active_channels[n] == 6 || active_channels[n] == 74)){	
			MIDI.programChange(n,active_channels[n]);
		}
	}

}

function startAudio (currentTime, fromCache){
	if (!self.replayer) return;
	if (!fromCache) {
		if (typeof (currentTime) === "undefined") currentTime = this.restart;
		if (self.playing) stopAudio();
		self.playing = true;
		self.data = self.replayer.getData();
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

	var queuedTimeOffset = 0.5;
	var note;
	var offset = 0; // to handle starting later in file.
	var messages = 0; //Chunks to look at;
	var data = self.data;	
	var ctx = getContext();
	var length = data.length;
    
	//
	//queuedTime = 0.5; // ??? where in File we are + .5 to give us a little time in the future to play thing. 
	queuedTime = queuedTimeOffset; // ??? where in File we are + .5 to give us a little time in the future to play thing. 
	startTime = ctx.currentTime; //Doesn't get used in this function. 
	//
	for (var n = 0; n < length && messages < 100; n++) {
//	for (var n = 0; n < length; n++) {
		queuedTime += data[n][1];
		if (queuedTime < currentTime) {
			offset = queuedTime;
			continue;
		}
		currentTime = queuedTime - offset; //where in file we are; accounting for starting in middle. Private Var
		var event = data[n][0].event; // current event;

//Supposed to handle time changes.
		if( event.type === "meta" && event.subtype === "setTempo"){
			miliSecondsPerBeat = event.microsecondsPerBeat * self.timeWarp / 1000;
    			measure = miliSecondsPerBeat * beatsPerMeasure;
			continue;
		}
		else if( event.type === "meta" && event.subtype === "timeSignature"){
			beatsPerMeasure = event.numerator * (4 / event.denominator);	
    			measure = miliSecondsPerBeat * beatsPerMeasure;
			continue;
		}
//Still not quite right...
		if(data[n][1]){
			if(!firstNoteFlag){
				firstNoteFlag = true;	//this is the first note;	
				measuresSoFar++;
				measureTimeSoFar = queuedTimeOffset;
				eventQueue.push({
					source: null,
        				interval:scheduleTracking(measuresSoFar, null, 
					null, measureTimeSoFar, offset, null, null ),
				}); 
			}
			var nextMeasureTime = measureTimeSoFar+measure;
	//		var nextMeasureTime = measuresSoFar*measure+queuedTimeOffset;
			for(var i = n+1; i < length; i++){
				if(data[i][1]){
					var nextEventTime = queuedTime + data[i][1];	
					if(nextEventTime > nextMeasureTime){
						measuresSoFar++;
						measureTimeSoFar = nextMeasureTime;
						eventQueue.push({
						source: null,
        					interval:scheduleTracking(measuresSoFar, null, 
							null, measureTimeSoFar, offset, null, null ),
						}); 
					}
					break;
				}	
			}
		}	

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
					//turns of note
					source: MIDI.noteOff(channel, note, currentTime / 1000 + ctx.currentTime),
					//schedules when to turn off note
					interval: scheduleTracking(false, channel, note, queuedTime, offset, 128)
				});
				break;
			default:
				break;
		}
	}

};

function stopAudio(){
	var ctx = getContext();
	self.playing = false;
	self.restart += (ctx.currentTime - startTime) * 1000;
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
	// reset noteRegistrar
	noteRegistrar = {};
	measuresSoFar = 0;
	measureTimeSoFar = 0;
	firstNoteFlag = false;
};




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
	self.restart = 0;
	self.currentTime = 0;
};
this.pause = function(){
	var tmp = self.restart;
	stopAudio();
	self.restart = tmp;
};
this.addListener = function(callback){
	onMidiEvent = callback;
};

this.removeListener = function(){
	onMidiEvent = undefined;
};

this.loadMidiFile = function(){
	self.replayer = new Replayer(MidiFile(self.currentData), self.timeWarp);
	self.data = self.replayer.getData();
	self.endTime = getLength();
    self.MIDIOffset = 0;
    active_channels = [];
	getActiveChannels();
};
this.loadFile = function(file, init, callback) {
	self.stop();
	if (file.indexOf("base64,") !== -1) {
		var data = window.atob(file.split(",")[1]);
		self.currentData = data;
		self.loadMidiFile();
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
			self.loadMidiFile();
            if(init) initChannelPrograms();
			if (callback) callback(data);
		}
	};
	fetch.send();
};

};



// =========================OLD WAY=========================

if (typeof (MIDI) === "undefined") var MIDI = {};
if (typeof (midiPlayer) === "undefined") midiPlayer = {};

//(function() { "use strict";
//
//    //public interface
//var root = midiPlayer;
//root.callback = undefined; // your custom callback goes here!
//root.currentTime = 0;
//root.endTime = 0; 
//root.restart = 0; 
//root.playing = false;
//root.timeWarp = 1;
//
////
//root.start =
//root.resume = function () {
//	if (root.currentTime < -1) root.currentTime = -1;
//	startAudio(root.currentTime);
//};
//
//root.pause = function () {
//	var tmp = root.restart;
//	stopAudio();
//	root.restart = tmp;
//};
//
//root.stop = function () {
//	stopAudio();
//	root.restart = 0;
//	root.currentTime = 0;
//};
//
//root.addListener = function(callback) {
//	onMidiEvent = callback;
//};
//
//root.removeListener = function() {
//	onMidiEvent = undefined;
//};
//
//root.clearAnimation = function() {
//	if (root.interval)  {
//		window.clearInterval(root.interval);
//	}
//};
//
//root.setAnimation = function(config) {
//	var callback = (typeof(config) === "function") ? config : config.callback;
//	var interval = config.interval || 30;
//	var currentTime = 0;
//	var tOurTime = 0;
//	var tTheirTime = 0;
//	//
//	root.clearAnimation();
//	root.interval = window.setInterval(function () {
//        $(window).trigger("blah");
//		if (root.endTime === 0) return;
//		if (root.playing) {
//			currentTime = (tTheirTime === root.currentTime) ? tOurTime - (new Date).getTime() : 0;
//			if (root.currentTime === 0) {
//				currentTime = 0;
//			} else {
//				currentTime = root.currentTime - currentTime;
//			}
//			if (tTheirTime !== root.currentTime) {
//				tOurTime = (new Date).getTime();
//				tTheirTime = root.currentTime;
//			}
//		} else { // paused
//			currentTime = root.currentTime;
//		}
//		var endTime = root.endTime;
//		var percent = currentTime / endTime;
//		var total = currentTime / 1000;
//		var minutes = total / 60;
//		var seconds = total - (minutes * 60);
//		var t1 = minutes * 60 + seconds;
//		var t2 = (endTime / 1000);
//		if (t2 - t1 < -1) return;
//		callback({
//			now: t1,
//			end: t2,
//			events: noteRegistrar
//		});
//	}, interval);
//};
//
//// helpers
//
//root.loadMidiFile = function() { // reads midi into javascript array of events
//	root.replayer = new Replayer(MidiFile(root.currentData), root.timeWarp);
//	root.data = root.replayer.getData();
//	root.endTime = getLength();
//};
//
//root.loadFile = function (file, callback) {
//	root.stop();
//	if (file.indexOf("base64,") !== -1) {
//		var data = window.atob(file.split(",")[1]);
//		root.currentData = data;
//		root.loadMidiFile();
//		if (callback) callback(data);
//		return;
//	}
//	///
//	var fetch = new XMLHttpRequest();
//	fetch.open('GET', file);
//	fetch.overrideMimeType("text/plain; charset=x-user-defined");
//	fetch.onreadystatechange = function () {
//		if (this.readyState === 4 && this.status === 200) {
//			var t = this.responseText || "";
//			var ff = [];
//			var mx = t.length;
//			var scc = String.fromCharCode;
//			for (var z = 0; z < mx; z++) {
//				ff[z] = scc(t.charCodeAt(z) & 255);
//			}
//			var data = ff.join("");
//			root.currentData = data;
//			root.loadMidiFile();
//			if (callback) callback(data);
//		}
//	};
//	fetch.send();
//};
//
//// Playing the audio
//
//var eventQueue = []; // hold events to be triggered
//var queuedTime; // 
//var startTime = 0; // to measure time elapse
//var noteRegistrar = {}; // get event for requested note
//var onMidiEvent = undefined; // listener callback
//var scheduleTracking = function (channel, note, currentTime, offset, message, velocity) {
//	var interval = window.setTimeout(function () {
//		var data = {
//			channel: channel,
//			note: note,
//			now: currentTime,
//			end: root.endTime,
//			message: message,
//			velocity: velocity
//		};
//		//
//		if (message === 128) {
//			delete noteRegistrar[note];
//		} else {
//			noteRegistrar[note] = data;
//		}
//		if (onMidiEvent) {
//			onMidiEvent(data);
//		}
//		root.currentTime = currentTime;
//		if (root.currentTime === queuedTime && queuedTime < root.endTime) { // grab next sequence
//			startAudio(queuedTime, true);
//		}
//	}, currentTime - offset);
//	return interval;
//};
//
//var getContext = function() {
//	if (MIDI.lang === 'WebAudioAPI') {
//		return midiPlayer.ctx;
//	} else if (!root.ctx) {
//		root.ctx = { currentTime: 0 };
//	}
//	return root.ctx;
//};
//
//var getLength = function() {
//	var data =  root.data;
//	var length = data.length;
//	var totalTime = 0.5;
//	for (var n = 0; n < length; n++) {
//		totalTime += data[n][1];
//	}
//	return totalTime;
//};
//
//var startAudio = function (currentTime, fromCache) {
//	if (!root.replayer) return;
//	if (!fromCache) {
//		if (typeof (currentTime) === "undefined") currentTime = root.restart;
//		if (root.playing) stopAudio();
//		root.playing = true;
//		root.data = root.replayer.getData();
//		root.endTime = MidiPlayer.getLength();
//	}
//	var note;
//	var offset = 0;
//	var messages = 0;
//	var data = root.data;	
//	var ctx = getContext();
//	var length = data.length;
//	//
//	queuedTime = 0.5;
//	startTime = ctx.currentTime;
//	//
//	for (var n = 0; n < length && messages < 100; n++) {
//		queuedTime += data[n][1];
//		if (queuedTime < currentTime) {
//			offset = queuedTime;
//			continue;
//		}
//		currentTime = queuedTime - offset;
//		var event = data[n][0].event;
//		if (event.type !== "channel") continue;
//		var channel = event.channel;
//		switch (event.subtype) {
//			case 'noteOn':
//				if (MIDI.channels[channel].mute) break;
//				note = event.noteNumber - (root.MIDIOffset || 0);
//				eventQueue.push({
//					event: event,
//					source: MIDI.noteOn(channel, event.noteNumber, event.velocity, currentTime / 1000 + ctx.currentTime),
//					interval: scheduleTracking(channel, note, queuedTime, offset, 144, event.velocity)
//				});
//				messages ++;
//				break;
//			case 'noteOff':
//				if (MIDI.channels[channel].mute) break;
//				note = event.noteNumber - (root.MIDIOffset || 0);
//				eventQueue.push({
//					event: event,
//					source: MIDI.noteOff(channel, event.noteNumber, currentTime / 1000 + ctx.currentTime),
//					interval: scheduleTracking(channel, note, queuedTime, offset, 128)
//				});
//				break;
//			default:
//				break;
//		}
//	}
//};
//
//var stopAudio = function () {
//	var ctx = getContext();
//	root.playing = false;
//	root.restart += (ctx.currentTime - startTime) * 1000;
//	// stop the audio, and intervals
//	while (eventQueue.length) {
//		var o = eventQueue.pop();
//		window.clearInterval(o.interval);
//		if (!o.source) continue; // is not webaudio
//		if (typeof(o.source) === "number") {
//			window.clearTimeout(o.source);
//		} else { // webaudio
//			var source = o.source;
//			source.disconnect(0);
//			source.noteOff(0);
//		}
//	}
//	// run callback to cancel any notes still playing
//	for (var key in noteRegistrar) {
//		var o = noteRegistrar[key]
//		if (noteRegistrar[key].message === 144 && onMidiEvent) {
//			onMidiEvent({
//				channel: o.channel,
//				note: o.note,
//				now: o.now,
//				end: o.end,
//				message: 128,
//				velocity: o.velocity
//			});
//		}
//	}
//	// reset noteRegistrar
//	noteRegistrar = {};
//};
//
//})();
