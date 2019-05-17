// simple node web server that displays hello world
// optimized for Docker image

const express = require('express');
// this example uses express web framework so we know what longer build times
// do and how Dockerfile layer ordering matters. If you mess up Dockerfile ordering
// you'll see long build times on every code change + build. If done correctly,
// code changes should be only a few seconds to build locally due to build cache.

const morgan = require('morgan');
// morgan provides easy logging for express, and by default it logs to stdout
// which is a best practice in Docker. Friends don't let friends code their apps to
// do app logging to files in containers.
const XXHash = require('xxhash');
const needle = require('needle');
const readPkg = require('read-pkg');

const pkg = readPkg.sync();

/**
 * 
 * http://localhost:84/?url=https://jsonplaceholder.typicode.com/posts
 * 
 */


// Api
const app = express();

//cache
const cache = require('./cache');

app.use(morgan('common'));

app.get('/', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Cache', 'Johnny Cache');
  //init
  let state = {
    url: req.query.url
  };

  //url required
  if (!state.url) {

    return res.send({
      name: pkg.name,
      version: pkg.version,
      hint: 'url query parameter required'
    }
  );
  }

  //calc hash
  state.hash = XXHash.hash64(Buffer.from(state.url), 0xCAFEBABE, 'hex');

  //try to get cache
  state.cache = cache.get(state.hash);

  if (state.cache) {
    res.setHeader('X-Cache-Method', 'Cached');
    res.setHeader('X-Cache-Updated', state.cache.updated);
    res.send(state.cache.data);
  } else {
    console.log(`Cache> ${state.hash} miss`);
  }

  //just fetch the stuff

  needle.get(state.url, function (error, response) {
    if (!error && response.statusCode == 200) {
      if (!res.headersSent){
        res.setHeader('X-Cache-Method', 'Fetched');
        res.send(response.body);
      }

      //cache it
      state.data = response.body;
      cache.add(state);

    } else {
      res.status(400).send(err);
    }


  });

  //res.send(state);
  //writeFile(`./cache/${state.hash}.json`, 'Hello file');
});

app.get('/healthz', function (req, res) {
  // do app logic here to determine if app is truly healthy
  // you should return 200 if healthy, and anything else will fail
  // if you want, you should be able to restrict this to localhost (include ipv4 and ipv6)
  res.send('I am happy and healthy\n');
});


module.exports = app;