/*
	The Cedric's Swiss Knife (CSK) - CSK logger toolbox

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




			/* NetServer transport */



// Load modules
var net = require( 'net' ) ;
var minimist = require( 'minimist' ) ;
//var async = require( 'async-kit' ) ;



// Empty constructor, it is just there to support instanceof operator
function Client() { throw new Error( "[cliClient] Cannot create a Client object directly" ) ; }
module.exports = Client ;



Client.cli = function cli()
{
	var client = Object.create( Client.prototype ) ;
	
	var options = minimist( process.argv.slice( 2 ) ) ;
	
	client.init( options ) ;
	
	return client ;
} ;



Client.prototype.init = function init( options )
{
	var socket = net.connect( options , function() { //'connect' listener
		console.log('connected to server!');
	});
	
	socket.on('data', function(data) {
		console.log(data.toString());
	});
	
	socket.on('end', function() {
		console.log('disconnected from server');
	});
	
	socket.on('close', function() {
		console.log('close');
	});
	
	socket.on('error', function( error ) {
		console.log('Error:',error);
	});
	
} ;


