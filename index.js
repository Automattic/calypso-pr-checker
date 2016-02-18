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

function getOpenPullRequests( cb ) {
  github.pullRequests.getAll( {
    user: 'Automattic',
    repo: 'wp-calypso',
    state: 'open',
    page: 2,
    per_page: 100
  }, cb );
}

function fetchAndProcessDiff( pr, cb ) {
  prs[ pr.url ] = pr;
  //console.log( 'Requesting diff for %s', pr.url );
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
        //console.log( '%s mentions lodash', pr.url );
        mentions[ pr.url ] = ( mentions[ pr.url ] || 0 ) + 1;
      }
    } );

    cb();
  } );
}

function fetchPrInfo( mentions, prUrl, cb ) {
  //console.log( 'fetching info for', prUrl );
  var pr = prs[ prUrl ];
  github.pullRequests.get( {
    user: 'Automattic',
    repo: 'wp-calypso',
    number: pr.number
  }, function( err, data ) {
    if ( data ) {
      prs[ prUrl ] = data;
    }
    cb( err );
  } )
}


getOpenPullRequests( function( err, data ) {
  if ( err ) {
    console.error( err );
    return;
  }

  //console.log( 'Found %d PRs', data.length );

  async.eachLimit( data, 10, fetchAndProcessDiff, function( err ) {
    if ( err ) {
      console.error( 'Crap', err );
    } else {
      //console.log( 'Done' );
      //console.log( 'Fetching PR info' );
      async.forEachOfLimit( mentions, 10, fetchPrInfo, function( err ) {
        if ( err ) {
          console.error( 'bad pr fetch', err );
        } else {
          for( var url in mentions ) {
            console.log( '%s, @%s, mergeable: %s', url.replace( 'api.', '' ).replace( '/repos', '' ).replace( 'pulls', 'pull' ), prs[ url ].user.login, prs[ url ].mergeable );
          }
        }
      } )

    }
  } );

} );
