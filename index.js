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
const bodyParser = require('body-parser');
const readPkg = require('read-pkg');
const compression = require('compression');
const serverTiming = require('server-timing');

const pkg = readPkg.sync();

let CACHE_DEBOUNCE_SEC = process.env.CACHE_DEBOUNCE_SEC || 5;

/**
 * 
 * http://localhost:84/?url=https://jsonplaceholder.typicode.com/posts
 * 
 */


// Api
const app = express();
app.use(bodyParser.text());
app.use(compression());
app.disable('x-powered-by');
app.use(serverTiming({
  total: false
}));

//cache
const cache = require('./cache');

app.use(morgan('common'));

//app.use('*', function (req, res, next) {
//  console.log('Request Type:', req.method);
//  next();
//});


function reply(req, res) {
  res.startTime('cache-hit', 'cache> Hit');

  
  res.setHeader('X-Cache', 'Johnny Cache');
  //init
  let state = {
    url: req.query.url,
    method: req.method,
    options: {
      headers: {
        'accept': req.headers.accept
      }
    }
  };

  //body must be optional
  if (req.method === 'POST'){
    state.body = req.body;
  }

  if (req.headers['content-type']){
    state.options.content_type = req.headers['content-type'];
  }

  //url required
  if (!state.url) {

    return res.send({
      name: pkg.name,
      version: pkg.version,
      cache: cache.stats(),
      hint: 'url query parameter required'
    });
  }

  //calc hash
  state.hash = XXHash.hash64(Buffer.from(state.url + (req.body || '')), 0xCAFEBABE, 'hex');

  //try to get cache
  let cachedState = cache.get(state.hash);
  if (cachedState) {
    res.setHeader('X-Cache-Method', 'Cached');
    res.setHeader('X-Cache-Updated', cachedState.updated);
    res.endTime('cache-hit');
    if (cachedState.contentType){
     res.setHeader('Content-Type', cachedState.contentType);
    } 
    res.send(cachedState.data);
  } else {
    console.log(`Cache> ${state.hash} miss`);
  }

  //just fetch the stuff

  if (cachedState){
    let diff = new Date() - cachedState.updated;
      if (diff < (CACHE_DEBOUNCE_SEC * 1000)){
        console.log(`Cache> ${state.hash} cache age below debounce diff (${diff}) - no update`);
        return true
      }
  }

  console.log(`Cache> ${state.hash} updating cache ${state.url}`);
  res.startTime('cache-fetch', 'cache> Fetch operation');
  //needle('put', 'https://hacking.the.gibson/login', { password: 'god' }, { json: true })

    needle(state.method, state.url, state.body, {...state.options}).then(function(response) {
      res.endTime('cache-fetch');
      if (!res.headersSent) {
        res.setHeader('X-Cache-Method', 'Fetched');
        res.endTime('cache-hit');
        res.send(response.body);
      }
      //cache it
      state.data = response.body;
      state.contentType = response.headers['content-type'];
      cache.add(state);
    })
    .catch(function(error) {
      res.endTime('cache-fetch');
      state.error = error;
      res.status(400).send(state);
    });

  }

  //writeFile(`./cache/${state.hash}.json`, 'Hello file');


app.get('/', reply);
app.post('/', reply);


app.get('/healthz', function (req, res) {
  // do app logic here to determine if app is truly healthy
  // you should return 200 if healthy, and anything else will fail
  // if you want, you should be able to restrict this to localhost (include ipv4 and ipv6)
  res.send('I am happy and healthy\n');
})

module.exports = app;