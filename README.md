coordinator server
===

POST /register {"webhook": "url of content server to respond to"}
    This stores a content server webhook url in a Map along with api-key.
        After calling ${webhook}/cashies_check.json and verifying it exists (or similar)
            If it does not verify it exists we blacklist the url for 10 minutes (to prevent amplification dos)

        
    returns
        {"api-key": "random string unique to this content server"}


POST /post {"txid": "xxx", "content": ""}
    This verifies and stores the content for a post 
        After looking up txid with bitdb and grabbing ipfs hash from op_return
            And verifying the content matches the ipfs hash (https://github.com/ipfs/js-ipfs/issues/1611)

    Once it is verified as correct content this will forward the data to all registered content servers like this:

        POST ${content_server_webhook}/post {"txid", "txid", "content": "", "api_key": "unique api key generated in register"}

        The content server should then perform same validation as above and return {"success": true}
            If the content server does not return {"success": true} we should remove that server from our list of content servers


content server
===

On boot call /register on the coordinator server and save the api_key it gives back

GET /cashies_check.json
    This is for server to verify this is actually a content server.
    Returns {"cashies_check": true}

POST /post {"txid", "txid", "content": "", "api_key": "unique api key generated in register"}
    Verifies content for post such as above and returns {"success": true}
        After verifying the api_key is the same as the one we registered with
    Once we verify we can store in database and show to users 


