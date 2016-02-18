#!/usr/bin/env node

var API = require( 'github' ),
  request = require( 'request' ),
  async = require( 'async' ),
  github = new API( {
    version: '3.0.0',
    protocol: 'https',
    host: 'api.github.com',
    timeout: 10 * 1000,
    headers: {
      'user-agent': 'Automattic-PR-Checker'
    }
  } ),
  mentions = {},
  prs = {};

function getOpenPullRequests( github, cb ) {
  github.pullRequests.getAll( {
    user: 'Automattic',
    repo: 'wp-calypso',
    state: 'open',
    page: 1,
    per_page: 100
  }, cb );
}

function fetchAndProcessDiff( pr, cb ) {
  prs[ pr.url ] = pr;
  console.log( 'Requesting diff for %s', pr.url );
  request( pr.diff_url, function( err, response, body ) {
    if ( err || response.statusCode !== 200 ) {
      cb( {
        url: pr.diff_url,
        err: err,
        statusCode: response && response.statusCode
      } );
      return;
    }

    body.replace( /^\+([^\+].*)/gm, function( match, line ) {
      if ( ~line.indexOf( 'lodash' ) ) {
        console.log( '%s mentions lodash', pr.url );
        mentions[ pr.url ] = ( mentions[ pr.url ] || 0 ) + 1
      }
    } );

    cb();
  } );
}


getOpenPullRequests( github, function( err, data ) {
  if ( err ) {
    console.error( err );
    return;
  }

  console.log( 'Found %d PRs', data.length );

  async.eachLimit( data, 10, fetchAndProcessDiff, function( err ) {
    if ( err ) {
      console.error( 'Crap', err );
    } else {
      console.log( 'Done' );
      console.log( '' );
      for( var url in mentions ) {
        console.log( '%s, @%s', url.replace( 'api.', '' ).replace( '/repos', '' ).replace( 'pulls', 'pull' ), prs[ url ].user.login );
      }
    }
  } );

} );
