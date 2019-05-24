
const writeFile = require('write');
const needle = require('needle');
const dir = require('node-dir');

let mapCache = {};

let CACHE_DEBOUNCE_SEC = process.env.CACHE_DEBOUNCE_SEC || 5;
let CACHE_MAX_AGE_SEC = process.env.CACHE_MAX_AGE_SEC || 60;
let CACHE_MAMA_INTERVAL_SEC = process.env.CACHE_MAMA_INTERVAL_SEC || 60;
let CACHE_MAMA_MAX_UPDATES = process.env.CACHE_MAMA_MAX_UPDATES || 5;

module.exports = {
    add: function (state, mode) {
        console.log(`Cache> ${state.hash} added`);
        if (mapCache[state.hash] && state.data){
            if (mode !== 'file'){
                mapCache[state.hash].updated = new Date();
            }
            mapCache[state.hash].data = state.data;
        } else {
            if (mode !== 'file'){
                state.updated = new Date();
            }
            mapCache[state.hash] = state;
        }
        if (state){
            writeFile(`./cache/${state.hash}.json`, JSON.stringify(state));
        }

    },

    get: function(hash) {
        console.log(`Cache> ${hash} requested`);
        return mapCache[hash];
    },
    stats: function(){
        return {
            items: Object.keys(mapCache).length,
            setup: {
                CACHE_MAX_AGE_SEC: CACHE_MAX_AGE_SEC,
                CACHE_MAMA_INTERVAL_SEC: CACHE_MAMA_INTERVAL_SEC,
                CACHE_MAMA_MAX_UPDATES: CACHE_MAMA_MAX_UPDATES,
                CACHE_DEBOUNCE_SEC: CACHE_DEBOUNCE_SEC
            }
        }
    }
}

function updateCache(state){
    console.log(`Cache> ${state.hash} to be updated`);
    if (state.url){
        needle(state.method, state.url, state.body, {...state.options}).then(function(response) {
            if (response.statusCode == 200){
                state.data = response.body;
                state.contentType = response.headers['content-type'];
                module.exports.add(state);
            } else {
                console.log(`Cache> ${state.hash} update failed due to invalid return code: ${response.statusCode}`);
            }
          })
          .catch(function(error) {
            console.log(`Cache> ${state.hash} error on update`, error);
          });


        /*needle.get(state.url, function (error, response) {
            if (!error && response.statusCode == 200) {
              //cache it
              state.data = response.body;
              module.exports.add(state);
            } else {
                console.log(`Cache> ${state.hash} error on update`, error);
            }
        });*/
    }
}


// take care of updating data, deleting old one
function mama(){
    let updates = 0;
    console.log(`Cache> mama comes in`);

    let candidates = [];
    for (let x in mapCache){
        let diff = new Date() - mapCache[x].updated;
        if (diff > (CACHE_MAX_AGE_SEC * 1000)){
            candidates.push({key: x, diff: diff});
        }
    }

    console.log(`Cache> mama found ${candidates.length} items to update`);

    candidates.sort((a, b) => (a.diff < b.diff) ? 1 : -1);
    
    candidates =  candidates.slice(0, CACHE_MAMA_MAX_UPDATES);

    console.log(`Cache> updating ${candidates.length} of max ${CACHE_MAMA_MAX_UPDATES} items`);

    for (let i=0,ii=candidates.length;i<ii;i++){
        setTimeout(function(){
            updateCache(mapCache[candidates[i].key]);
        }, 100 * i);
    }
    
    
}

var loop = setInterval(mama, CACHE_MAMA_INTERVAL_SEC*1000);


//load from cache
dir.readFiles('./cache', {
        match: /.json$/
    },
    function(err, content, next) {
        if (err) throw err;
        let state = JSON.parse(content);
        state.updated =  new Date(state.updated);
        module.exports.add(state, 'file');
        next();
    },
    function(err, files){
        if (err) throw err;
        console.log(`Cache> finished reading files:  ${files.length}`);
    });