Moruga
======

Moruga is a spider genus, a district in Trinidad, the hottest pepper in the world, and a transparent HTTP debugging proxy. 

<img src="http://caribbeancelebs.com/wp-content/uploads/2012/02/Trinidad-Moruga-Scorpion.jpg" width="300px"/> 


### Example ###

```
./moruga.js -u http://duckduckgo.com -f filters.example.js -v
```

* Listen for HTTP requests on all IP addresses, using port 80
* Import the filters.example.js module and load "pre" and "post" filter arrays
* Proxy requests to http://duckduckgo.com[PATH_AND_QUERY_STRING]
  * E.g.: http://moruga.example.com/chunky?meat=bacon ---> http://duckduckgo.com/chunky?meat=bacon
* Print requests/responses to/from the user agent

### HTTPS ###

```
./moruga.js -u http://duckduckgo.com -f filters.example.js --ssl-key=server-key.pem --ssl-cert=server-cert.pem
```

* Listen for HTTPS requests on all IP addresses, using port 443
* Use default list of CAs, including well-known ones like Verisign
* Import the filters.example.js module and load "pre" and "post" filter arrays
* Proxy requests to http://duckduckgo.com[PATH_AND_QUERY_STRING]

