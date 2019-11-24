require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const btoa = require('btoa');
const fetch = require('node-fetch');
const ipfshash = require('ipfs-only-hash');
const NodeCache = require('node-cache');
const cryptoRandomString = require('crypto-random-string');



const app = express();
app.use(bodyParser.json())


const bitdb = {
  query: (query) => new Promise((resolve, reject) => {
    if (! query) {
      return resolve(false);
    }
    const b64 = btoa(JSON.stringify(query));
    const url = process.env.BITDB + b64;

    console.log(url)

    fetch(url)
    .then((r) => r = r.json())
    .then((r) => {
      if (r.hasOwnProperty('error')) {
        reject(new Error(r['error']));
      }
      resolve(r);
    });
  }),
};

const attached_content_servers = new Map();
const webhook_blacklist_cache = new NodeCache({
    stdTTL: process.env.WEBHOOK_BLACKLIST_TTL,
});
app.post('/register', (req, res) => {
    if (typeof req.query.webhook === 'undefined') {
        return res.send({'success': 'false', 'error': 'webhook missing'});
    }

    // TODO turn url into domain:port like
    // https://someexamplesite.com:593/loolool2837 -> https://someexamplesite:593/cashies_check.json
    const webhook_url = req.query.webhook;
    if (webhook_blacklist_cache.get(webook_url) !== undefined) {
        return res.send({'success': 'false', 'error': 'please wait to try registering again'});
    }

    // put in blacklist to stop amplified ddos
    webhook_blacklist_cache.set(webook_url, null);

    fetch(webook_url)
    .then((r) => r.json())
    .then((r) => {
        if (typeof r.cashies_check === 'undefined') {
            throw new Error('cashies_check not found');
        }

        const api_key = cryptoRandomString({length: 20});
        attached_content_servers.set(webhook_url, api_key);
        
        return res.send({'success': 'true', 'api-key': api_key});
    })
    .catch((err) => {
        return res.send({'success': 'false', 'error': err.message});
    });
});

app.post('/post', (req, res) => {
    if (typeof req.query.txid === 'undefined') {
        return res.send({'success': 'false', 'error': 'txid missing'});
    }
    if (typeof req.query.content === 'undefined') {
        return res.send({'success': 'false', 'error': 'content missing'});
    }

    bitdb.query({
        "v": 3,
        "q": {
            "find": {
                "tx.h": req.query.txid
            },
            "limit": 10
        }
    })
    .then((data) => {
        const tx = data.c.length > 0 ? tx.c[0] : data.u.length > 0 ? tx.u[0] : null;
        if (tx === null) {
            return res.send({'success': 'false', 'error': 'could not find tx in bitdb'});
        }

        if (typeof tx.out[0].s5 === 'undefined') {
            return res.send({'success': 'false', 'error': 'could not find tx.out[0].s5'});
        }

        const buf = Buffer.from(req.query.content);
        const bhash = ipfshash.of(buf);
        
        if (bhash !== tx.out[0].s5) {
            return res.send({'success': 'false', 'error': 'hash does not match'});
        }

        attached_content_servers.forEach((webhook_url, api_key) => {
            fetch(webhook_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    txid: req.query.txid,
                    content: req.query.content,
                    api_key: api_key
                })
            });
        });

        return res.send({'success': 'true'});
    });
});

app.listen(process.env.PORT, () => console.log(`Coordination server listening on port ${process.env.PORT}!`))
