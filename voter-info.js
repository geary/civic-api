// voter-info.js by Michael Geary
// See LICENSE for copyright and license

var staticMapWidth = 400, staticMapHeight = 300;

var pendingAddresses;


// Templates for HTML code and other strings
// Leading/trailing whitespace and all tab characters will be removed
// (this file uses tabs for indentation)
// Note that the \-escaped newlines do not insert a newline in the string;
// end a line with \n\ if you want an actual newline, or use \n elsewhere
var template = {
	oneLineAddress: '{{line1}}, {{city}}, {{state}} {{zip}}',
	optionElection: '\
		<option value="{{id}}">\
			ID {{id}}: {{electionDay}} {{name}}\
		</option>',
	optionNoElections: '\
		<option disabled>\
			No elections\
		</option>',
	staticMap: '\
		<!--<a class="staticmap" target="_blank" href="{{fullMapUrl}}" title="Click to view full map">-->\
		<div class="staticmap">\
			<img style="border:none; width:{{width}}px; height:{{height}}px;" \
				src="http://maps.googleapis.com/maps/api/staticmap?sensor=false&NOTkey={{key}}&size={{width}}x{{height}}&markers={{markers}}">\
		</div>\
		<!--</a>-->',
	staticMarker: '&markers=color:{{color}}%7Clabel:{{label}}%7C{{location}}',
	voterInfo: '\
		<div class="voterinfo">\
			{{{staticMap}}}\
			<div class="address">{{address}}</div>\
			<pre class="json"><code>{{json}}</code></pre>\
 		</div>'
};


// Compile all the templates, trimming whitespace, removing tab characters,
// and converting Mustache-style syntax to Underscore:
// {{escapedValue}}
// {{{unescapedValue}}}
// {{@JavaScriptCode}}
for( var t in template ) {
	var text = $.trim( template[t].replace( /\t/g, '' ) )
		.replace( /\{\{\{/g, '<%=' )
		.replace( /\{\{@/g, '<%' )
		.replace( /\{\{/g, '<%-' )
		.replace( /\}\}\}/g, '%>' )
		.replace( /\}\}/g, '%>' )
	template[t] = _.template( text );
}


// Parse the query string in a URL and return an object of
// the key=value pairs.
// Example:
//     var url = 'http://example.com/test?a=b&c=d'
//     var p = parseQuery(url);
// Now p contains { a:'b', c:'d' }
function parseQuery( query ) {
	if( query == null ) return {};
	if( typeof query != 'string' ) return query;
	if( query.charAt(0) == '{') return eval('(' + query + ')');

	var params = {};
	if( query ) {
		var array = query.replace( /^[#?]/, '' ).split( '&' );
		for( var i = 0, n = array.length;  i < n;  ++i ) {
			var p = array[i].split( '=' ),
				key = decodeURIComponent( p[0] ),
				value = decodeURIComponent( p[1] );
			if( key ) params[key] = value;
		}
	}
	return params;
}


// Get the URL query parameters for this page
var params = parseQuery( location.search );


// Set default parameters
params.root = params.root || 'https://www.googleapis.com';
params.api = params.api  || 'civicinfo/us_v1';


// Wrap the Civic Information API calls and use custom
// root and api values from this page's URL
function gapiFetch( method, path, body, callback ) {
	gapi.client.request({
		root: params.root,
		path: '/' + params.api + '/' + path,
		method: method,
		body: body
	}).execute( callback );
}


// Get the list of available elections
function getElections( callback ) {
	gapiFetch( 'GET', 'elections', null, loadElectionList );
}


// Get voter information for an election ID and address
function getVoterInfo( electionId, address, callback ) {
	gapiFetch( 'POST',
		'voterinfo/' + electionId + '/lookup' + (
			checked('#chkOfficial') ? '?officialOnly=true' : ''
		),
		{ address: address },
		callback
	);
}


// Populate the election list selector - called via getElections()
function loadElectionList( response ) {
	var elections = response && response.elections || [];
	if( ! elections.length ) {
		$('#electionlist').html( template.optionNoElections() );
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


// Process the next address - either look it up or re-enable
// submit button when done, and skip blank addresses
function nextAddress() {
	if( pendingAddresses.length ) {
		var address = $.trim( pendingAddresses.shift() );
		if( address )
			loadAddress( address );
		else
			nextAddress();
	}
	else {
		enableSubmit( true );
	}
}


// Start the lookup for one address
function loadAddress( address ) {
	var electionId = $('#electionlist').val();
	getVoterInfo( electionId, address, function( response ) {
		loadVoterInfo( response, address );
	});
}


// Populate the info list for one address response
function loadVoterInfo( response, address ) {
	var html = template.voterInfo({
		json: $.trim( JSON.stringify( response, null, '    ' ) ),
		address: address,
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
		state &&
		state.local_jurisdiction &&
		state.local_jurisdiction.electionAdministrationBody;
	var markers =
		staticMarkers( response.normalizedInput, 'green', 'H' ) +
		staticMarkers( leo && leo.physicalAddress, 'blue', 'L', '#chkMapLeo' ) +
		staticMarkers( response.pollingLocations, 'red', 'P', '#chkPolling' ) +
		staticMarkers( response.earlyVoteSites, 'yellow', 'E', '#chkMapEarly' );
	return template.staticMap({
		key: settings.apiKey,
		width: staticMapWidth,
		height: staticMapHeight,
		markers: markers,
		fullMapUrl: fullMapUrl
	});
}


// Return static map URL code for all the markers in a locations list
// or for a single location marker (only if checkbox checked or not present)
function staticMarkers( locations, color, label, checkbox ) {
	if( ! checked(checkbox) ) return '';  // only if selected
	if( ! locations ) return '';
	if( locations.length == null ) locations = [ locations ];
	return _.map( locations, function( location ) {
		return template.staticMarker({
			location: urlAddress( location.address || location ),
			color: color,
			label: label
		});
	}).join('');
}


// Is a checkbox (specified by CSS selector) checked?
// Also return true if checkbox selector is null
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


// Startup code, called when the GAPI client is ready
function load() {
	gapi.client.setApiKey( settings.apiKey );
	getElections( loadElectionList );
}
