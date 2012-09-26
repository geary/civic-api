// voter-info.js by Michael Geary
// See LICENSE for copyright and license

var staticMapWidth = 400, staticMapHeight = 300;

var pendingAddresses;


// Use {{variable}} instead of <%=variable%> in templates
_.templateSettings = {
	interpolate : /\{\{(.+?)\}\}/g
};

// Templates for all the HTML UI code
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

// Compile all the templates
for( var t in template )
	template[t] = _.template( $.trim( template[t].replace( /\t/g, '' ) ) );


// Get the list of available elections
function getElections( callback ) {
	var request = gapi.client.request({
		path: '/civicinfo/us_v1/elections',
		method: 'GET'
	});
	request.execute( loadElectionList );
}


// Get voter information for an election ID and address
function getVoterInfo( electionId, address, callback ) {
	var request = gapi.client.request({
		path: '/civicinfo/us_v1/voterinfo/' + electionId + '/lookup',
		method: 'POST',
		body: { address: address }
	});
	request.execute( callback );
}


// Startup code, called when the GAPI client is ready
function load() {
	gapi.client.setApiKey( settings.apiKey );
	getElections( loadElectionList );
}


// Populate the election list selector - called via getElections()
function loadElectionList( response ) {
	var elections = response && response.elections || [];
	if( ! elections.length ) {
		$('#electionlist').html( '<option disabled>No elections</option>' );
		return;
	}
	$('#electionlist').html( _.map( elections, function( election ) {
		return template.optionElection( election );
	} ).join('') );
	
	enableSubmit( true );
}


// Enable or disable the submit button
function enableSubmit( enable ) {
	$('#submit')[0].disabled = ! enable;
}


// Submit event handler for input form - start the address lookups
$('#inputform').submit( function( event ) {
	enableSubmit( false );
	$('#outputwrap').empty();
	pendingAddresses = $('#inputs').val().split('\n');
	nextAddress();
	event.preventDefault();
});


// Process the next address - either look it up or
// re-enable submit button when done
function nextAddress() {
	var address = $.trim( pendingAddresses.shift() );
	if( address )
		loadAddress( address );
	else
		enableSubmit( true );
}


// Start the lookup for one address
function loadAddress( address ) {
	var electionId = $('#electionlist').val();
	getVoterInfo( electionId, address, loadVoterInfo );
}


// Populate the info list for one address response
function loadVoterInfo( response ) {
	var html = template.voterInfo({
		json: JSON.stringify( response, null, '    ' ),
		staticMap: formatStaticMap( response )
	});
	$('#outputwrap').append( html );
	nextAddress();
}


// Return HTML for a static map with the selected markers
function formatStaticMap( response ) {
	var fullMapUrl = '';  // template.fullMapUrl({ home: home.replace( /%20/g, '+' ) });
	var state =
		response.state &&
		response.state[0];
	var leo =
		state.local_jurisdiction &&
		state.local_jurisdiction.electionAdministrationBody;
	var markers =
		addressMarker( response.normalizedInput, 'green', 'H' ) +
		addressMarker( leo && leo.physicalAddress, 'blue', 'L', '#chkMapLeo' ) +
		voteMarkers( response.pollingLocations, 'red', 'P', '#chkPolling' ) +
		voteMarkers( response.earlyVoteSites, 'yellow', 'E', '#chkMapEarly' );
	return template.staticMap({
		key: settings.apiKey,
		width: staticMapWidth,
		height: staticMapHeight,
		markers: markers,
		fullMapUrl: fullMapUrl
	});
}


// Return static map URL code for all the markers in a locations list
// (either polling places or early voting locations)
function voteMarkers( locations, color, label, checkbox ) {
	if( ! checked(checkbox) ) return '';  // only if selected
	if( !( locations && locations.length ) ) return '';
	return _.map( locations, function( location ) {
		return addressMarker( location.address, color, label );
	}).join('');
}


// Return static map URL code for a single address marker
function addressMarker( location, color, label, checkbox ) {
	if( ! checked(checkbox) ) return '';  // only if selected
	if( ! location ) return '';
	return template.staticMarker({
		location: urlAddress( location ),
		color: color,
		label: label
	});
}


// Is a checkbox (specified by CSS selector) checked?
// Return true if checkbox selector is null
function checked( checkbox ) {
	return ! checkbox  ||  $(checkbox)[0].checked;
}


// Return URL code for a single address object
function urlAddress( address ) {
	return encodeURIComponent( oneLineAddress(address) )
}


// Return a single line formatted address given an address object
function oneLineAddress( address ) {
	return template.oneLineAddress( address );
}


// Initialization - fill in default addresses from private settings file
if( settings.defaultAddresses )
	$('#inputs').val( settings.defaultAddresses );
