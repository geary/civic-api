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
			<img style="border:none; width:{{width}}px; height:{{height}}px;" \
				src="http://maps.googleapis.com/maps/api/staticmap?sensor=false&NOTkey={{key}}&size={{width}}x{{height}}&markers={{markers}}">\
		</a>',
	staticMarker: '&markers=color:{{color}}%7Clabel:{{label}}%7C{{location}}',
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
	var fullMapUrl = '';  // template.fullMapUrl({ home: home.replace( /%20/g, '+' ) });
	var markers =
		addressMarker( response.normalizedInput, 'green', 'H' ) +
		voteMarkers( response.pollingLocations, 'red', 'V' ) +
		voteMarkers( response.earlyVoteSites, 'yellow', 'E' );
	return template.staticMap({
		key: settings.apiKey,
		width: staticMapWidth,
		height: staticMapHeight,
		markers: markers,
		fullMapUrl: fullMapUrl
	});
}


function voteMarkers( locations, color, label ) {
	if( !( locations && locations.length ) ) return '';
	return _.map( locations, function( location ) {
		return addressMarker( location.address, color, label );
	}).join('');
}


function addressMarker( location, color, label ) {
	return template.staticMarker({
		location: urlAddress( location ),
		color: color,
		label: label
	});
}


function urlAddress( address ) {
	return encodeURIComponent( oneLineAddress(address) )
}


function oneLineAddress( address ) {
	return template.oneLineAddress( address );
}


if( settings.defaultAddresses )
	$('#inputs').val( settings.defaultAddresses );
