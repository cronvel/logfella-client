/*
	The Cedric's Swiss Knife (CSK) - CSK logfella mon client

	Copyright (c) 2015 Cédric Ronvel 
	
	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/





// Load modules
var net = require( 'net' ) ;
var minimist = require( 'minimist' ) ;
var term = require( 'terminal-kit' ).terminal ;
var package = require( '../package.json' ) ;
//var async = require( 'async-kit' ) ;



// Empty constructor, it is just there to support instanceof operator
function Client() { throw new Error( "[cliClient] Cannot create a Client object directly" ) ; }
module.exports = Client ;



Client.cli = function cli()
{
	var client = Object.create( Client.prototype ) ;
	
	term.magenta.bold( 'Logfella mon client ' ).dim( 'v%s by Cédric Ronvel\n' , package.version ) ;
	
	if ( process.argv.length <= 2 )
	{
		term( '\nUsages are:\n' ) ;
		term( '\tlogfella-client <port>\n' ) ; 
		term( '\tlogfella-client <host> <port>\n' ) ; 
		term( '\tlogfella-client --port <port>\n' ) ; 
		term( '\tlogfella-client --host <host> --port <port>\n' ) ; 
		term( '\tlogfella-client --path <path-to-unix-socket>\n' ) ; 
		term( '\n' ) ;
		process.exit() ;
	}
	
	var options = minimist( process.argv.slice( 2 ) ) ;
	
	if ( options._.length )
	{
		if ( options._.length >= 2 ) { options.host = options._[ 0 ] ; options.port = options._[ 1 ] ; }
		else { options.port = options._[ 0 ] ; }
	}
	
	client.init( options ) ;
	
	return client ;
} ;



var cleaned = false ;

function cleanExit()
{
	if ( cleaned ) { return ; }
	cleaned = true ;
	//term.fullscreen( false ) ;
	term( '\n' ) ;
	process.exit() ;
}



Client.prototype.init = function init( options )
{
	var self = this ;
	
	this.lastMinute = {} ;
	this.lastFiveMinutes = {} ;
	this.lastFifteenMinutes = {} ;
	
	process.on( 'SIGINT' , cleanExit ) ;
	process.on( 'exit' , cleanExit ) ;
	process.on( 'asyncExit' , cleanExit ) ;
	
	//term.fullscreen() ;
	term.clear() ;
	
	var socket = net.connect( options , function() {
		//'connect' listener
		term.brightGreen( 'Connected to the server!' ) ;
	} ) ;
	
	socket.on( 'data' , function( data ) {
		
		try {
			data = JSON.parse( data ) ;
		}
		catch ( error ) {
			// Error: just skip the frame
			console.error( error ) ;
		}
		
		if ( data.mon ) { self.updateMon( data ) ; }
		else { self.updateLog( data ) ; }
	} ) ;
	
	socket.on( 'end' , function() {
		term.brightRed( 'Disconnected from server...' ) ;
		cleanExit() ;
	} ) ;
	
	socket.on( 'close' , function() {
		//console.log( 'close' ) ;
	} ) ;
	
	socket.on( 'error' , function( error ) {
		console.error( 'Error:' ,error ) ;
	} ) ;
	
} ;



Client.prototype.updateLog = function updateLog( data )
{
	term( data.message + '\n' ) ;
} ;



function round( n )
{
	if ( n >= 1000 ) { return Math.round( n ) ; }
	if ( n >= 100 ) { return Math.round( n * 10 ) / 10 ; }
	return Math.round( n * 100 ) / 100 ;
}



Client.prototype.updateMon = function updateMon( data )
{
	var self = this , k , v ;
	
	term.moveTo( 1 , 1 ).eraseLineAfter().eraseDisplayBelow() ;
	term.brightYellow( data.app + ' ' ).magenta( data.hostname + ' (' + data.pid + ') ' ).blue( 'up %is\n' , data.uptime ) ;
	term.cyan( new Date( data.time ) + '\n' ) ;
	term( '\n\n' ) ;
	
	term.bold() ;
	term.column( 21 , 'CURRENT' ).column( 33 , 'ALL TIME' ) ;
	
	if ( this.lastMinute.mon ) { term.column( 45 , 'LAST MIN' ) ; }
	if ( this.lastFiveMinutes.mon ) { term.column( 57 , 'LAST 5 MIN' ) ; }
	if ( this.lastFifteenMinutes.mon ) { term.column( 69 , 'LAST 15 MIN' ) ; }
	
	term.bold( false )( '\n' ) ;
	
	for ( k in data.mon )
	{
		term.green( k ).column( 19 , ': ' ).cyan( data.mon[ k ] ) ;
		
		if ( typeof data.mon[ k ] === 'number' )
		{
			term.column( 32 , ' ' ).magenta( '%f/min' , round( data.mon[ k ] * 60 / data.uptime ) ) ;
			
			if ( this.lastMinute.mon )
			{
				v = + this.lastMinute.mon[ k ] || 0 ;
				term.column( 44 , ' ' ).brightYellow( '%f/min' , round( data.mon[ k ] - v ) ) ;
			}
			
			if ( this.lastFiveMinutes.mon )
			{
				v = + this.lastFiveMinutes.mon[ k ] || 0 ;
				term.column( 56 , ' ' ).yellow( '%f/min' , round( ( data.mon[ k ] - v ) / 5 ) ) ;
			}
			
			if ( this.lastFifteenMinutes.mon )
			{
				v = + this.lastFifteenMinutes.mon[ k ] || 0 ;
				term.column( 68 , ' ' ).yellow( '%f/min' , round( ( data.mon[ k ] - v ) / 15 ) ) ;
			}
		}
		
		term( '\n' ) ;
	}
	
	setTimeout( function() { self.lastMinute = data ; } , 60000 ) ;
	setTimeout( function() { self.lastFiveMinutes = data ; } , 300000 ) ;
	setTimeout( function() { self.lastFifteenMinutes = data ; } , 900000 ) ;
} ;



