//What comes next:
//-use channels option
//-figure out how to show channels 'n' stuff;
//-move the channels stuff to a helper function.
//-figure out what functions I need.

(function($) {

    $.widget("ui.midiPlayer", {
        options: {
            midi_file: null,
            default_instrument: "acoustic_grand_piano",
            channels: [],
            show_channels: false,
            instrument_options: "default", //behavior for display of instrument in channel table
            updateInstrumentOptions: null,
            //synth: null,
        },
        _private_vars: {
            player: null,
            active_channels: null,
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
                        var playerDiv = $("<div>").css("height","35px").appendTo(el); 
                        var buttonsContainer = $("<div>").addClass("ui-midiPlayer-buttons-container");	
                        var play = $("<button>").addClass("ui-midiPlayer-play").text("play").appendTo(buttonsContainer);
                        var stop = $("<button>").addClass("ui-midiPlayer-stop").text("stop").appendTo(buttonsContainer);

                        buttonsContainer.appendTo(playerDiv);

                        var currentTime = $("<span>").addClass("ui-midiPlayer-currentTime").text("0:00").appendTo(playerDiv);
                        var capsule = $("<div>").addClass("ui-midiPlayer-capsule").appendTo(playerDiv);
                        var duration = $("<span>").addClass("ui-midiPlayer-duration").text("-0:00").appendTo(playerDiv);

                        var masterVol = $("<div>").addClass("ui-midiPlayer-masterVolumeContainer");	
                        var vol = $("<div>").addClass("ui-midiPlayer-volume");
                        var a = $("<a>").addClass("ui-state-default").addClass("ui-corner-all").addClass("ui-slider-handle");
                        $("<span>").addClass("ui-icon").addClass("ui-icon-volume-on").appendTo(a);
                        a.appendTo(vol);
                        vol.appendTo(masterVol);
                        masterVol.appendTo(playerDiv);

                        self._makeMasterVolumeSlider(vol);
                        self._makePlayStopButtons(play,stop);
                        self._makeCapsule(capsule,currentTime,duration,play);

                        secret.active_channels = player.get_active_channels();
                        var active_channels = secret.active_channels;

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
                        if(o.show_channels === true) self._makeChannelsTable(el);

                        window.setInterval( function(){ $(capsule).trigger("timeUpdate"); },204); 

                        MIDI.loader.stop();
                        if(instruments.length > 0) MIDI.loadPlugin({ instruments: instruments, callback: function(){ $(".ui-midiPlayer").midiPlayer("updateInstrumentOptions"); MIDI.loader.stop(); } });


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
                    var options = { label: "pause", icons: { primary: "ui-icon-pause" }, };
                    $(play_selector).button("option",options);
                },
        })
        .on("timeUpdate", function(event){
            $(this).slider("value",(player.currentTime/player.endTime*100)); 
            $(currentTime_selector).text(self._timeFormatting(player.currentTime));
            $(duration_selector).text("-" + self._timeFormatting(player.endTime - player.currentTime));

        });

    },    
    _makeChannelsTable: function(el){
        var self = this;
        var player = self._private_vars.player;
        var active_channels = self._private_vars.active_channels;
        var table = $("<table>")
        .addClass("ui-midiPlayer-channelTable");

        var thead = $("<thead>")
        .addClass("ui-midiPlayer-channelTitle")
        .appendTo(table);

        var titleTr = $("<tr>")
        .appendTo(thead);

        $("<th>").addClass("ui-midiPlayer-channelNum").text("#").appendTo(titleTr);
        $("<th>").addClass("ui-midiPlayer-soloMute").text("S").appendTo(titleTr);
        $("<th>").addClass("ui-midiPlayer-soloMute").text("M").appendTo(titleTr);
        $("<th>").addClass("ui-midiPlayer-program").text("Instrument").appendTo(titleTr);
        $("<th>").addClass("ui-midiPlayer-channelVol").text("Channel Volume").appendTo(titleTr);

        $(table).appendTo(el);

        var tbody = $("<tbody>").appendTo(table);
        for(i = 0; i<16; i++){
                var tr = $("<tr>").addClass("ui-midiPlayer-channel")
                .addClass("ui-midiPlayer-channel-" + (i+1))
                .addClass("ui-midiPlayer-inactive").appendTo(tbody);    
                $("<td>").text(i+1).addClass("ui-midiPlayer-channelNum").appendTo(tr);

                var soloTd = $("<td>").appendTo(tr);
                var solo = $("<input>").text("SOLO")
                .addClass("ui-midiPlayer-solo")
                .attr("type","checkbox")
                .uniqueId()
                .change( function () {
                    //var id = $(this).parents().eq(1).attr("class").replace(/\D/g,'');
                    var parentTr = $(this).parents().eq(1);
                    var id = parentTr.find(".ui-midiPlayer-channelNum").text() - 1;
                    var muteSelector = parentTr.find(".ui-midiPlayer-mute");

                    if( $(this).is(':checked')){ if( $(muteSelector).is(':checked')){
                        $(muteSelector).prop("checked", false);
                        $(muteSelector).button("refresh");
                        player.channels[id].mute = false;
                    } 
                    player.channels[id].solo = true;

                    if(player.playing){
                        player.pause(true);
                        player.resume();
                    }
                }
                else{
                    player.channels[id].solo = false;
                    if(player.playing){
                        player.pause(true);
                        player.resume();
                    }
                }

            })
            .appendTo(soloTd);

            var soloId = $(solo).attr("id"); 

            var soloLabel = $('<label>')
            .attr("for",soloId)
            .addClass("ui-midiPlayer-soloMute")
            .text("SOLO")
            .appendTo(soloTd);


            var muteTd  = $("<td>").appendTo(tr);
            var mute = $("<input>").text("MUTE")
            .addClass("ui-midiPlayer-mute")
            .attr("type","checkbox")
            .uniqueId()
            .change( function () {
                //var id = $(this).parents().eq(1).attr("class").replace(/\D/g,'');
                var parentTr = $(this).parents().eq(1);
                var id = parentTr.find(".ui-midiPlayer-channelNum").text() - 1;
                var soloSelector = parentTr.find(".ui-midiPlayer-solo");

                if( $(this).is(':checked')){
                    if( $(soloSelector).is(':checked')){
                        $(soloSelector).prop("checked", false);
                        $(soloSelector).button("refresh");
                        player.channels[id].solo = false;
                    } 
                    player.channels[id].mute = true;

                    if(player.playing){
                        player.pause(true);
                        player.resume();
                    }
                }
                else{
                    player.channels[id].mute = false;
                    if(player.playing){
                        player.pause(true);
                        player.resume();
                    }
                }

            })
            .appendTo(muteTd);
            var muteId = mute.attr("id");

            var muteLabel = $('<label>')
            .attr("for",muteId)
            .addClass("ui-midiPlayer-soloMute")
            .text("MUTE")
            .appendTo(muteTd);


            $("#"+soloId) .button({ text: false, icons: {primary: "icon-microphone"},})
        $("#"+muteId) .button({ text: false, icons: {primary: "icon-mute"},})

        var programTd =     $("<td>").appendTo(tr);

        var program = $("<select>")
        .addClass("ui-midiPlayer-program")
        .change(function(){
            var parentTr = $(this).parents().eq(1);
            var channel = parentTr.find(".ui-midiPlayer-channelNum").text() - 1;
            var program = $(this).val();
            player.channels[channel]['instrument'] = program;
            if(player.playing){
                player.pause(true);
                player.resume();
            }
        })

        .appendTo(programTd);

        //self.updateInstrumentOptions();
        //    for(var n = 0; n < active_channels.length; n++){
            //      // var opt = $("<option>").val(active_channels[n])
            //      //     .text(MIDI.GeneralMIDI.byId[active_channels[n]].instrument)
            //      //     .appendTo(program);

            //       if(n === i) opt.attr('selected',true);
            //    }

            var volumeTd = $("<td>").appendTo(tr);

            var volume = $('<div>')
            .addClass("ui-midiPlayer-channelVol")
            .slider({
                "range": "min", 
                "min": 0,
                "max": 127,
                "value": 127,
                "change": (function(event,ui){
                    var parentTr = $(this).parents().eq(1);
                    var channel = parentTr.find(".ui-midiPlayer-channelNum").text() - 1;
                    var volume = ui.value;
                    player.channels[channel]['volume'] = volume; 
                    if(player.playing){
                        player.pause(true);
                        player.resume();
                    }
            }),
    })
    .appendTo(volumeTd);

    if(typeof(active_channels[i]) !== "number"){
        $("#"+muteId).button("disable");
        $("#"+soloId).button("disable");
        solo.prop("disabled",true);
        program.prop("disabled",true);
        volume.slider("disable")
    } 
}
    },
    _setOption: function(option, value) {
    },
    updateInstrumentOptions: function(){
        var self = this;
        var el = self.element;
        var active_channels = self._private_vars.player.get_active_channels();
        var programSelector = $(el).find("tbody").find(".ui-midiPlayer-program");

        programSelector.empty();
        for (var instrument in MIDI.Soundfont){
            var inst_num = MIDI.GeneralMIDI.byName[instrument].number;
            var opt = $("<option>").val(inst_num).text(MIDI.GeneralMIDI.byName[instrument].instrument).appendTo(programSelector);
        } 
        for(var n = 0; n < active_channels.length; n++){
            var channelSelector = ".ui-midiPlayer-channel-" + (n+1);
            $(el).find(channelSelector).find(".ui-midiPlayer-program").find("option[value='" + active_channels[n] + "']").attr('selected',true);	

        }
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
                            if(player.playing){ player.pause(true); player.resume(); }
                        }
                    }
                },
        })
        .mouseenter(function(event) {
            if ($('.ui-slider-handle.ui-state-active').length) { return; }
            $(this).css({
                'margin-top': (((1 - player.MIDIMasterVol/100 ) * -100) + 5) + 'px',
                'height': '100px',
            }).find('.ui-slider-range').show();
        })
        .mouseleave(function() {
            $(this).not('.ui-slider-sliding').css({
                'margin-top': '',
                'height': ''
                }).find('.ui-slider-range').hide();
            }).find('.ui-slider-range').addClass('ui-corner-bottom').hide().end();


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
