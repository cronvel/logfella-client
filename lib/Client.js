/*
	Logfella Client

	Copyright (c) 2015 - 2018 Cédric Ronvel

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



var net = require( 'net' ) ;
var minimist = require( 'minimist' ) ;
var term = require( 'terminal-kit' ).terminal ;
var string = require( 'string-kit' ) ;
var logfellaClientPackage = require( '../package.json' ) ;



function Client() {}
module.exports = Client ;



Client.cli = function cli() {
	var client = new Client() ;

	term.magenta.bold( 'Logfella mon client ' ).dim( 'v%s by Cédric Ronvel\n' , logfellaClientPackage.version ) ;

	if ( process.argv.length <= 2 ) {
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

	if ( options._.length ) {
		if ( options._.length >= 2 ) { options.host = options._[ 0 ] ; options.port = options._[ 1 ] ; }
		else { options.port = options._[ 0 ] ; }
	}

	client.init( options ) ;

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



Client.prototype.init = function init( options ) {
	this.lastMinute = {} ;
	this.lastFiveMinutes = {} ;
	this.lastFifteenMinutes = {} ;

	process.on( 'SIGINT' , cleanExit ) ;
	process.on( 'exit' , cleanExit ) ;
	process.on( 'asyncExit' , cleanExit ) ;

	var socket = net.connect( options , () => {
		//'connect' listener
		term.clear() ;
		term.brightGreen( 'Connected to the server!\n' ) ;
	} ) ;

	socket.on( 'data' , ( data ) => {
		try {
			data = JSON.parse( data ) ;
		}
		catch ( error ) {
			// Error: just skip the frame
			term( '%E' , error ) ;
		}

		if ( data.levelName === 'mon' ) { this.updateMon( data ) ; }
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



Client.prototype.updateLog = function updateLog( data ) {
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



Client.prototype.updateMon = function updateMon( data ) {
	var k , v ;

	term.moveTo( 1 , 1 ).eraseLineAfter().eraseDisplayBelow() ;
	term.brightYellow( data.app + ' ' ).magenta( data.hostname + ' (' + data.pid + ') ' ) ;
	term.blue( 'up %s\n' , formatDuration( data.uptime ) ) ;
	term.cyan( new Date( data.time ) + '\n' ) ;
	term( '\n\n' ) ;

	term.bold() ;
	term.column( 21 , 'CURRENT' ).column( 33 , 'ALL TIME' ) ;

	if ( this.lastMinute.mon ) { term.column( 45 , 'LAST MIN' ) ; }
	if ( this.lastFiveMinutes.mon ) { term.column( 57 , 'LAST 5 MIN' ) ; }
	if ( this.lastFifteenMinutes.mon ) { term.column( 69 , 'LAST 15 MIN' ) ; }

	term.bold( false )( '\n' ) ;

	for ( k in data.mon ) {
		term.green( k ).column( 19 , ': ' ).cyan( data.mon[ k ] ) ;

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


