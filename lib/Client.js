/*
	Logfella Client

	Copyright (c) 2015 - 2019 Cédric Ronvel

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

"use strict" ;



const net = require( 'net' ) ;
const term = require( 'terminal-kit' ).terminal ;
const string = require( 'string-kit' ) ;
const cliManager = require( 'utterminal' ).cli ;



function Client( socketOptions ) {
	this.socketOptions = socketOptions ;

	this.lastMinute = {} ;
	this.lastFiveMinutes = {} ;
	this.lastFifteenMinutes = {} ;
}

module.exports = Client ;



Client.cli = function() {
	/* eslint-disable indent */
	cliManager.package( require( '../package.json' ) )
		.app( 'Logfella Mon Client' )
		.description( "Display monitoring information from a Logfella running application." )
		.strict
		.helpOption
		.restArgs( 'restArgs' )
			.description( "<port> or <host> <port>" )
		.opt( 'host' ).string
			.description( "The Logfella Mon server's host to connect to" )
			.typeLabel( 'host' )
		.opt( 'port' ).integer
			.description( "The Logfella Mon server's port to connect to" )
			.typeLabel( 'port' )
		.opt( 'path' ).string
			.description( "The Logfella Mon server's UNIX socket to connect to" )
			.typeLabel( 'path/to/unix/socket' ) ;
	/* eslint-enable indent */

	var args = cliManager.run() ;

	if ( args.restArgs && args.restArgs.length ) {
		if ( args.restArgs.length >= 2 ) { args.host = args.restArgs[ 0 ] ; args.port = parseInt( args.restArgs[ 1 ] , 10 ) ; }
		else { args.port = parseInt( args.restArgs[ 0 ] , 10 ) ; }
	}

	var client = new Client( args ) ;
	client.start() ;

	return client ;
} ;



var cleaned = false ;

function cleanExit() {
	if ( cleaned ) { return ; }
	cleaned = true ;
	//term.fullscreen( false ) ;
	term( '\n' ) ;
	process.exit() ;
}



Client.prototype.start = function() {
	process.on( 'SIGINT' , cleanExit ) ;
	process.on( 'exit' , cleanExit ) ;
	process.on( 'asyncExit' , cleanExit ) ;

	var socket = net.connect( this.socketOptions , () => {
		//'connect' listener
		term.clear() ;
		term.brightGreen( 'Connected to the server!' ) ;
	} ) ;

	socket.on( 'data' , ( data ) => {

		try {
			data = JSON.parse( data ) ;
		}
		catch ( error ) {
			// Error: just skip the frame
			term( '%E' , error ) ;
		}

		if ( data.mon ) { this.updateMon( data ) ; }
		else { this.updateLog( data ) ; }
	} ) ;

	socket.on( 'end' , () => {
		term.brightRed( 'Disconnected from server...' ) ;
		cleanExit() ;
	} ) ;

	socket.on( 'close' , () => {
		//console.log( 'close' ) ;
	} ) ;

	socket.on( 'error' , ( error ) => {
		if ( error.code === 'ECONNREFUSED' ) {
			term.bold.red( 'Error: Connection refused ^-(%s)\n' , error.message ) ;
			cleanExit() ;
		}
		else {
			term( '%E' , error ) ;
		}
	} ) ;
} ;



Client.prototype.updateLog = function( data ) {
	term( data.message + '\n' ) ;
} ;



function round( n ) {
	if ( n >= 1000 ) { return Math.round( n ) ; }
	if ( n >= 100 ) { return Math.round( n * 10 ) / 10 ; }
	return Math.round( n * 100 ) / 100 ;
}



function formatDuration( duration ) {
	var seconds = '' + ( Math.floor( duration ) % 60 ) ;
	var minutes = '' + ( Math.floor( duration / 60 ) % 60 ) ;
	var hours = '' + ( Math.floor( duration / 3600 ) % 24 ) ;
	var days = Math.floor( duration / 86400 ) ;

	if ( seconds.length === 1 ) { seconds = '0' + seconds ; }
	if ( minutes.length === 1 ) { minutes = '0' + minutes ; }
	if ( hours.length === 1 ) { hours = '0' + hours ; }

	if ( days ) {
		return string.format( '%d days %s:%s:%s' , days , hours , minutes , seconds ) ;
	}

	return string.format( '%s:%s:%s' , hours , minutes , seconds ) ;

}



Client.prototype.updateMon = function( data ) {
	var k , v ;

	term.moveTo( 1 , 1 ).eraseLineAfter()
		.eraseDisplayBelow() ;
	term.brightYellow( data.app + ' ' ).magenta( data.hostname + ' (' + data.pid + ') ' )
		.blue( 'up %s\n' , formatDuration( data.uptime ) ) ;
	term.cyan( new Date( data.time ) + '\n' ) ;
	term( '\n\n' ) ;

	term.bold() ;
	term.column( 21 , 'CURRENT' ).column( 33 , 'ALL TIME' ) ;

	if ( this.lastMinute.mon ) { term.column( 45 , 'LAST MIN' ) ; }
	if ( this.lastFiveMinutes.mon ) { term.column( 57 , 'LAST 5 MIN' ) ; }
	if ( this.lastFifteenMinutes.mon ) { term.column( 69 , 'LAST 15 MIN' ) ; }

	term.bold( false )( '\n' ) ;

	for ( k in data.mon ) {
		term.green( k ).column( 19 , ': ' )
			.cyan( data.mon[ k ] ) ;

		if ( typeof data.mon[ k ] === 'number' ) {
			term.column( 32 , ' ' ).magenta( '%f/min' , round( data.mon[ k ] * 60 / data.uptime ) ) ;

			if ( this.lastMinute.mon ) {
				v = + this.lastMinute.mon[ k ] || 0 ;
				term.column( 44 , ' ' ).brightYellow( '%f/min' , round( data.mon[ k ] - v ) ) ;
			}

			if ( this.lastFiveMinutes.mon ) {
				v = + this.lastFiveMinutes.mon[ k ] || 0 ;
				term.column( 56 , ' ' ).yellow( '%f/min' , round( ( data.mon[ k ] - v ) / 5 ) ) ;
			}

			if ( this.lastFifteenMinutes.mon ) {
				v = + this.lastFifteenMinutes.mon[ k ] || 0 ;
				term.column( 68 , ' ' ).yellow( '%f/min' , round( ( data.mon[ k ] - v ) / 15 ) ) ;
			}
		}

		term( '\n' ) ;
	}

	setTimeout( () => { this.lastMinute = data ; } , 60000 ) ;
	setTimeout( () => { this.lastFiveMinutes = data ; } , 300000 ) ;
	setTimeout( () => { this.lastFifteenMinutes = data ; } , 900000 ) ;
} ;

