Basic usage:

must include: 
./js/MIDI/AudioDetect.js
./js/MIDI/LoadPlugin.js
./js/MIDI/Plugin.js" 
./js/MIDI/Player.js" 
./js/Widgets/Loader.js 

./inc/jasmid/stream.js
./inc/jasmid/midifile.js
./inc/jasmid/replayer.js
./inc/Base64.js
./inc/base64binary.js

jquery/js/jquery-1.9.1.js
jquery/js/jquery-ui-1.10.3.custom.js
jquery/js/jquery.ui.midiPlayer.js

./jquery/css/smoothness/jquery-ui-1.10.3.custom.css
./jquery/css/ui.midiPlayer.css

One day I will minify the code.

-------------

MINIMAL USAGE

<pre>
<script>
$("#player").midiPlayer({midi_file: "./my_midi.midi"});
</script>
<body>
<div id="player"></div>
</pre>


Must be a midifile on the server. Can't handle links yet.

-------------


CODE EXAMPLES (from the repo)


-------------

DEMOS


-------------



-----------
MIDIJS INfo
* <a href="./soundfont/soundfont-ogg.js">MIDI.Soundfont.js</a>: Customizable base64 Soundfont.
* <a href="./js/MIDI.Plugin.js">MIDI.Plugin.js</a>: Ties together the following frameworks;


* <a href="./js/MIDI.Player.js">MIDI.Player.js</a>: Streams the MIDI to the browser.


// <b>Callback whenever a note is played;</b>
MIDI.Player.removeListener(); // removes current listener.
MIDI.Player.addListener(function(data) { // set it to your own function!
    var now = data.now; // where we are now
    var end = data.end; // time when song ends
    var channel = data.channel; // channel note is playing on
    var message = data.message; // 128 is noteOff, 144 is noteOn
    var note = data.note; // the note
    var velocity = data.velocity; // the velocity of the note
    var metronome = data.metronome; // clickat every measure
    // then do whatever you want with the information!
});


* <a href="https://dvcs.w3.org/hg/audio/raw-file/tip/midi/specification.html">Web MIDI API</a>: W3C proposal by Jussi Kalliokoski & Chris Wilson
* <a href="https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html">Web Audio API</a>: W3C proposal by Chris Rogers
* <a href="http://dev.w3.org/html5/spec/Overview.html">&lt;audio&gt;</a>: HTML5 specs
* Flash package: <a href="http://www.schillmania.com/projects/soundmanager2/">SoundManager2</a> by <a href="http://schillmania.com">Scott Schiller</a>
* <a href="https://github.com/gasman/jasmid">jasmid</a>: Reads MIDI file byte-code, and translats into a Javascript array.
* <a href="http://blog.danguer.com/2011/10/24/base64-binary-decoding-in-javascript/">base642binary.js</a>: Cleans up XML base64-requests for Web Audio API.
