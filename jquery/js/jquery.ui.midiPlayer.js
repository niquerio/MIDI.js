//What comes next:
//-use channels option
//-figure out how to show channels 'n' stuff;
//-move the channels stuff to a helper function.
//-figure out what functions I need.

(function($) {

    $.widget("ui.midiPlayer", {
		options: {
			midi_file: null,
			default_instrument: "recorder",
			channels: [],
			//synth: null,
		},
        _private_vars: {
            player: null,
        },
				
		_create: function() {
			var self = this,
				o = self.options,
				el = self.element.addClass("ui-widget ui-midiPlayer");
            var secret = self._private_vars;

			if(!o.midi_file) throw "no midi File";	
			//if(!o.synth) throw "no Synthesizer";	
            if(!MIDI.loader) MIDI.loader = new widgets.Loader;

            MIDI.loadPlugin({ 
                instruments: o.default_instrument,
                callback: function(){
                    secret.player = new MidiPlayer;
                    var player = secret.player;
                    player.initChannels();
                    player.loadFile(o.midi_file,1,function(){
                    
                    var buttonsContainer = $("<div>").addClass("ui-midiPlayer-buttons-container");	
                    var play = $("<button>").addClass("ui-midiPlayer-play").text("play").appendTo(buttonsContainer);
                    var stop = $("<button>").addClass("ui-midiPlayer-stop").text("stop").appendTo(buttonsContainer);
                    
                    buttonsContainer.appendTo(el);
                    
                    var currentTime = $("<span>").addClass("ui-midiPlayer-currentTime").text("0:00").appendTo(el);
                    var capsule = $("<div>").addClass("ui-midiPlayer-capsule").appendTo(el);
                    var duration = $("<span>").addClass("ui-midiPlayer-duration").text("-0:00").appendTo(el);
                    
                    var masterVol = $("<div>").addClass("ui-midiPlayer-masterVolumeContainer");	
                    var vol = $("<div>").addClass("ui-midiPlayer-volume");
                    var a = $("<a>").addClass("ui-state-default").addClass("ui-corner-all").addClass("ui-slider-handle");
                    $("<span>").addClass("ui-icon").addClass("ui-icon-volume-on").appendTo(a);
                    a.appendTo(vol);
                    vol.appendTo(masterVol);
                    masterVol.appendTo(el);
                    
                    self._makeMasterVolumeSlider(vol);
                    self._makePlayStopButtons(play,stop);
                    self._makeCapsule(capsule,currentTime,duration,play);

                    var active_channels = player.get_active_channels();
                    var instruments = [];
                    for(var i = 0; i < active_channels.length; i++){
                            var program_num = active_channels[i];
                        if(typeof(program_num) === "number"){
                            var inst_name =  MIDI.GeneralMIDI.byId[program_num].id;
                            if(!MIDI.Soundfont[inst_name]){
                                var sf_inst_url = MIDI.soundfontUrl + inst_name + "-" + MIDI.filetype + ".js";
                                $.ajax({
                                    url: sf_inst_url,
                                    async: false,
                                    type:'HEAD',
                                    error: function()
                                    {
                                        var default_instrument = MIDI.GeneralMIDI.byName[o.default_instrument].number;
                                        for(var n = 0; n<16; n++){
                                            if(player.channels[n].instrument == program_num){
                                                player.channels[n].instrument = default_instrument;
                                            }
                                        }
                                    },
                                    success: function()
                                    {
                                        instruments.push(inst_name);
                                    }
});
                            }
                        }
                    }

                    if(instruments.length > 0) MIDI.loadPlugin({ instruments: instruments, callback: function(){ MIDI.loader.stop(); } });

                    window.setInterval( function(){
                            $(capsule).trigger("timeUpdate");
                            },204); 
                    
                    MIDI.loader.stop();
                });
                 }
		    });

		},
				
		destroy: function() {			
			//this.element.next().remove();
			
		},
_makeCapsule: function(capsule_selector,currentTime_selector,duration_selector,play_selector){
                                     var player = this._private_vars.player;
                                     var self = this;
	    	$(capsule_selector)
	    	    .slider({
	    	        "range": 'min',
	    	        "max": 100,
	    	        "min": 0,
	    	        "value": 0,
	    	        "slide": function(event,ui){
	    	            player.pause(true);
	    	            player.currentTime = ((ui.value/100)*player.endTime);
	    	            player.resume();
	    	            var options = {
	    	                label: "pause",
	    	                icons: { primary: "ui-icon-pause" },
	    	            };
	    	            $(play_selector).button("option",options);
	    	        },
	    	       // "disabled": true,
	    	        
	    	    })
	    	.on("timeUpdate", function(event){
	    	   $(this).slider("value",(player.currentTime/player.endTime*100)); 
	    	   $(currentTime_selector).text(self._timeFormatting(player.currentTime));
	    	   $(duration_selector).text("-" + self._timeFormatting(player.endTime - player.currentTime));
	
	    	});

        },    
		_setOption: function(option, value) {
			//$.Widget.prototype._setOption.apply( this, arguments );
			//
			//var el = this.element,
			//	cap = el.next(),
			//	capHeight = cap.outerHeight() - parseInt(cap.css("paddingTop")) + parseInt(cap.css("paddingBottom"));
			//
			//switch (option) {
			//	case "location":
			//		(value === "top") ? cap.css("top", el.offset().top) : cap.css("top", el.offset().top + el.height() - capHeight);
			//		break;
			//	case "color":
			//		el.next().css("color", value);
			//		break;
			//	case "backgroundColor":
			//		el.next().css("backgroundColor", value);
			//		break;
			//}
		},
        _makePlayStopButtons: function(play_selector, stop_selector){
                                     var player = this._private_vars.player;
	    	$(play_selector).button({
	    	    text: false,
	    	    label: "play",
	    	    icons: { primary: "ui-icon-play" },
	    	}).click( function(){
	    	    var options;
	    	    if ( $( this ).text() === "play" ) {
	    	        options = {
	    	            label: "pause",
	    	            icons: { primary: "ui-icon-pause" },
	    	        };
	    	        player.resume();
	    	    } else {
	    	        options = {
	    	            label: "play",
	    	            icons: { primary: "ui-icon-play" },
	    	        };
	    	        player.pause(true);
	    	    }
	    	    $( this ).button( "option", options );
	
	    	});
		//.button("disable");	
	
	    	$(stop_selector).button({
	    	    text: false,
	    	    label: "stop",
	    	    icons: { primary: "ui-icon-stop" },
	    	}).click( function(){
	    	    player.stop();
	    	    var options = {
	    	        label: "play",
	    	        icons: { primary: "ui-icon-play" },
	    	    }
	    	    $(play_selector).button("option",options);
	    	});

          },
		_makeMasterVolumeSlider: function(vol_selector){
                                     var player = this._private_vars.player;
		    $(vol_selector)	
		    // create the volume slider
		    //$('.ui-midiPlayer .volume')
		        .slider({
		            max: 100,
		            orientation: 'vertical',
		            range: 'min',
		            step: 1,
		            value: 100,
		            //disabled: true,
		            start: function(event, ui) {
		                $(this).addClass('ui-slider-sliding');
		                $(this).parents('.ui-slider').css({
		                    'margin-top': (((1 - player.MIDIMasterVol/100 ) * -100) + 5) + 'px',
		                    'height': '100px'
		                }).find('.ui-slider-range').show();
		            },
		            slide: function(event, ui) {
		                //player.pause(true);
		                $(this).css({ 'height': '100px' }).find('.ui-slider-range').show();
		            },
		            stop: function(event, ui) {
		                $(this).removeClass('ui-slider-sliding');
		                var overHandle = $(event.originalEvent.target)
		                    .closest('.ui-slider-handle')
		                    .length > 0;
		                if (!overHandle) {
		                    $(this).css({ 'height': '' }).find('.ui-slider-range').hide();
		                }
		              },
		            change: function(event, ui) {
		                if (ui.value >= 0 && ui.value <= 100) {
		                    if (ui.value != player.MIDIMasterVol ) {
		                        player.MIDIMasterVol = ui.value;
		                        if(player.playing){
		                            player.pause(true);
		                            player.resume();
		                        }
		                    }
		                }
		            }
		        })
		        .mouseenter(function(event) {
		        //	if(!$(this).slider("option","disabled")){
		        		if ($('.ui-slider-handle.ui-state-active').length) { return; }
		        		$(this).css({
		        			'margin-top': (((1 - player.MIDIMasterVol/100 ) * -100) + 5) + 'px',
		        			'height': '100px',
		        			}).find('.ui-slider-range').show();
		        //		}
		        })
		        .mouseleave(function() {
		        //	if(!$(this).slider("option","disabled")){
		        	$(this).not('.ui-slider-sliding').css({
		        		'margin-top': '',
		        		'height': ''
		        		}).find('.ui-slider-range').hide();
		        //	}
		         })
		        .find('.ui-slider-range').addClass('ui-corner-bottom').hide().end();
		
		
		},
		_timeFormatting: function(n) {
    n = n/1000;
    var minutes = n / 60 >> 0; 
    var seconds = String(n - (minutes * 60) >> 0);
    if (seconds.length == 1) seconds = "0" + seconds;
    return minutes + ":" + seconds;
	},
	});

	
})(jQuery);
