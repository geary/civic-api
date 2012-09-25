// voter-info-test.js by Michael Geary
// See LICENSE for copyright and license

var staticMapWidth = 400, staticMapHeight = 300;

_.templateSettings = {
	interpolate : /\{\{(.+?)\}\}/g
};

var template = {
	oneLineAddress: '{{line1}}, {{city}}, {{state}} {{zip}}',
	optionElection: '\
		<option value="{{id}}">\
			ID {{id}}: {{electionDay}} {{name}}\
		</option>',
	staticMap: '\
		<a class="staticmap" target="_blank" href="{{fullMapUrl}}" title="Click to view full map">\
			<img style="border:none; width:{{width}}px, height:{{height}}px" \
				src="http://maps.googleapis.com/maps/api/staticmap?sensor=false&NOTkey={{key}}&size={{width}}x{{height}}&markers=color:green%7Clabel:H%7C{{home}}{{vote}}">\
		</a>',
	staticMapMarker: '&markers=color:red%7Clabel:V%7C{{vote}}',
	voterInfo: '\
		<div class="voterinfo">\
			{{staticMap}}\
			<pre><code>{{json}}</code></pre>\
		</div>'
};

for( var t in template )
	template[t] = _.template( $.trim( template[t].replace( /\t/g, '' ) ) );


function S() {
	return Array.prototype.join.call( arguments, '' );
}


function load() {
	gapi.client.setApiKey( settings.apiKey );
	var request = gapi.client.request({
		path: '/civicinfo/us_v1/elections',
		method: 'GET'
	});
	request.execute( loadElectionList );
}


function loadElectionList( response ) {
	var elections = response && response.elections || [];
	if( ! elections.length ) {
		$('#electionlist').html( '<option disabled>No elections</option>' );
		return;
	}
	$('#electionlist').html( _.map( elections, function( election ) {
		return template.optionElection( election );
	} ).join('') );
	
	$('#submit')[0].disabled = false;
}


$('#inputform').submit( function( event ) {
	$('#outputwrap').empty();
	$('#inputs').val().split('\n').forEach( function( address ) {
		address = $.trim( address );
		if( ! address ) return;
		loadAddress( address );
	});
	event.preventDefault();
});


function loadAddress( address ) {
	var electionId = $('#electionlist').val();
	var request = gapi.client.request({
		path: '/civicinfo/us_v1/voterinfo/' + electionId + '/lookup',
		method: 'POST',
		body: { address: address }
	});
	request.execute( loadVoterInfo );
}


function loadVoterInfo( response ) {
	var html = template.voterInfo({
		json: JSON.stringify( response, null, '    ' ),
		staticMap: formatStaticMap( response )
	});
	$('#outputwrap').append( html );
}


function formatStaticMap( response ) {
	var home = encodeURIComponent( oneLineAddress( response.normalizedInput ) );
	var fullMapUrl = '';  // template.fullMapUrl({ home: home.replace( /%20/g, '+' ) });
	return template.staticMap({
		key: settings.apiKey,
		width: staticMapWidth,
		height: staticMapHeight,
		home: home,
		vote: voteMarkers( response.pollingLocations ),
		fullMapUrl: fullMapUrl
	});
}


function voteMarkers( locations ) {
	if( !( locations && locations.length ) ) return '';
	return _.map( locations, function( location ) {
		return template.staticMapMarker({
			vote: encodeURIComponent( oneLineAddress( location.address ) )
		});
	}).join('');
}


function oneLineAddress( address ) {
	return template.oneLineAddress( address );
}

if( settings.defaultAddresses )
	$('#inputs').val( settings.defaultAddresses );
