# Check EU VAT numbers in the browser

The European Commission operates a service that allows for validating VAT numbers of European companies. This system is called the VAT Information Exchange System (VIES).

VIES has a free [web form](http://ec.europa.eu/taxation_customs/vies/vatRequest.html) (for manual VAT validation) and a [SOAP service](http://ec.europa.eu/taxation_customs/vies/faq.html#item_16), which makes it possible to make automated requests for validating VAT numbers.

The VIES SOAP endpoint is [http://ec.europa.eu/taxation_customs/vies/services/checkVatService]().

The CoffeeScript and JavaScript code in this repository provides a simple function that you can use to validate EU VAT numbers with VIES using SOAP, directly from your browser. [Try it out here](http://nephics.github.io/euvat-direct). You can also [check a list of EU VAT numbers](http://nephics.github.io/euvat-direct/batch.html).

Note this caveat: Since VIES doesn't support [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) or [JSONP](https://en.wikipedia.org/wiki/JSONP), to use the code in this repository **you need a proxy server that is CORS compliant to reach VIES from the browser**. See proxy configuration example below.

You can grab the [CoffeeScript](https://github.com/nephics/euvat-direct/blob/master/euvat-direct.coffee) or [JavaScript](https://github.com/nephics/euvat-direct/blob/master/euvat-direct.js) code for use in your own projects. The function `viesRequest` is the important one, it sends the request and parses the response from VIES. The other code is an example implementation, used in the [demo](http://nephics.github.io/euvat-direct) [pages](http://nephics.github.io/euvat-direct/batch.html).

## Requirements

To run this code you need:
* [jQuery](http://jquery.com/)
* a CORS compliant proxy server (see below)

The code is tested with jQuery version v2.1.4, and Safari v9.0.1.

## Setting up a proxy

Here is a simple CORS proxy server config for [nginx](http://nginx.org). With this configuration, the CORS proxy url is [http://proxy.example.com/vies]().

```
server {
  listen  80;
  server_name  proxy.example.com;

  location = /vies {
    valid_referers ~^example.com.*;

    if ($invalid_referer) {
      return 403;
    }

    add_header 'Access-Control-Allow-Origin' "$http_origin";

    if ($request_method = OPTIONS) {
      add_header 'Access-Control-Allow-Methods' 'OPTIONS, POST';
      add_header 'Access-Control-Max-Age' 1728000;
      return 200;
    }

    if ($request_method != POST) {
      return 405;
    }

    proxy_set_header Host ec.europa.eu;
    proxy_pass http://ec.europa.eu/taxation_customs/vies/services/checkVatService;
    proxy_pass_request_headers off;
    proxy_buffering off;
  }

  location / {
    return 403;
  }
}
```

You can also choose to set up a [node.js CORS Proxy server](https://github.com/gr2m/CORS-Proxy).

## Support

Support for the software can be provided on a commercial basis, please see [www.nephics.com](https://www.nephics.com) for contact information.

## License

Copyright (c) 2015-2017 Nephics AB.  
MIT License (See the LICENSE file.)
