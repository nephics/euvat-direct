/*
https://github.com/nephics/euvat-direct
Copyright 2015-2021 Nephics AB
MIT License
*/

(function() {
  var batchCheck, checkVat, country_codes, showResult, toggleSubmit, viesRequest,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  viesRequest = function(vatno, callback) {

    /* Check an EU VAT number with VIES
    
       viesRequest(vatno, callback)
    
     The callback function is called with two arguments: error and result
    
     Where error is either null, or a string:
    
       "invalid", "parsererror": VIES returned an invalid reply
    
       "nocontent", "error", "timeout", "abort": standard jQuery AJAX error status
    
     If error is null, results is an object with the following keys
    
       countryCode: string with the VAT number country code
       vatNumber:   string with the VAT number without country code
       requestDate: string with date of the request
       valid:       boolean indicator (true/false)
       name:        string with company name (if available)
       address:     string with company address (if available)
     */
    var cors_proxy_url, xmlRequest;
    cors_proxy_url = 'https://cors.bridged.cc/https://ec.europa.eu/taxation_customs/vies/services/checkVatService';
    xmlRequest = ['<?xml version="1.0" encoding="UTF-8"?>', '<SOAP-ENV:Envelope xmlns:ns0="urn:ec.europa.eu:taxud:vies:services:checkVat:types" ', 'xmlns:ns1="https://schemas.xmlsoap.org/soap/envelope/" ', 'xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance" ', 'xmlns:SOAP-ENV="https://schemas.xmlsoap.org/soap/envelope/">', '<SOAP-ENV:Header/><ns1:Body><ns0:checkVat>', '<ns0:countryCode>', vatno.slice(0, 2).toUpperCase(), '</ns0:countryCode><ns0:vatNumber>', vatno.slice(2), '</ns0:vatNumber></ns0:checkVat></ns1:Body></SOAP-ENV:Envelope>'].join('');
    $.ajax({
      url: cors_proxy_url,
      data: xmlRequest,
      method: 'POST',
      dataType: 'xml',
      success: function(xmlDoc) {
        var el, i, len, ref, result, tag, xml;
        xml = $(xmlDoc);
        if (xml.find('checkVatResponse').length === 0) {
          if (xml.find(' IP_BLOCKED').length > 0) {
            callback('request blocked');
          }
          else {
            callback('invalid');
          }
          return;
        }
        result = {};
        ref = ['countryCode', 'vatNumber', 'requestDate', 'valid', 'name', 'address'];
        for (i = 0, len = ref.length; i < len; i++) {
          tag = ref[i];
          el = xml.find(tag);
          if (tag === 'requestDate') {
            result[tag] = el.text().slice(0, 10);
          } else if (tag === 'valid') {
            result[tag] = el.text() === 'true';
          } else {
            result[tag] = el.text();
          }
        }
        callback(null, result);
      },
      error: function(xhr, status, error) {
        callback(status);
      }
    });
  };

  country_codes = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI'];

  showResult = function(html) {
    return $('#result').html(html);
  };

  toggleSubmit = function() {
    var b;
    b = $('button[type=submit]');
    return b.prop('disabled', !b.prop('disabled'));
  };

  checkVat = function(vatno) {
    var ref;
    if (!vatno) {
      showResult('<p><strong>No VAT number specified.</strong>');
      return;
    }
    if (vatno.length < 7 || vatno.length > 20) {
      showResult('<p><strong>This is not a VAT number.</strong>');
      return;
    }
    if (ref = vatno.slice(0, 2).toUpperCase(), indexOf.call(country_codes, ref) < 0) {
      showResult("<p>" + vatno.slice(0, 2) + " is not one of the valid country codes: " + (country_codes.join(', ')));
      return;
    }
    showResult('<p>Checking...');
    toggleSubmit();
    viesRequest(vatno, function(err, res) {
      if (err) {
        if (err.includes('blocked')) {
          showResult("<p>Sorry, but <strong>access to VIES is currently blocked</strong>. Contact admins at: TAXUD-VIESWEB@ec.europa.eu");
        }
        else {
          showResult("<p>Sorry, but VIES appears to be down. (The error code is '" + err + "'.)");
        }
      } else {
        showResult(["<p>The VAT number " + (res.valid ? '<strong>is' : 'is <strong>not') + " valid.</strong>", '<p>The full VAT response:', '<pre>', JSON.stringify(res, null, '  ', '</pre>')].join('\n'));
      }
      toggleSubmit();
    });
  };

  batchCheck = function(vatnos) {
    var checklist, createTable, fake, i, invalid_code, iter, len, ref, results, retry, vatno;
    if (vatnos.length === 0) {
      showResult("<p><strong>You didn't provide any VAT numbers to check!</strong>");
      return;
    }
    checklist = [];
    invalid_code = 0;
    for (i = 0, len = vatnos.length; i < len; i++) {
      vatno = vatnos[i];
      fake = false;
      if (vatno.length < 7 || vatno.length > 20) {
        fake = true;
      } else if (ref = vatno.slice(0, 2).toUpperCase(), indexOf.call(country_codes, ref) < 0) {
        invalid_code += 1;
        fake = true;
      }
      checklist.push([vatno, fake]);
    }
    results = [];
    createTable = function() {
      var encodedUri, j, k, l, len1, len2, res, s;
      l = ['data:text/csv;charset=utf-8,', 'vatno,valid,company,address\n'];
      for (j = 0, len1 = results.length; j < len1; j++) {
        res = results[j];
        l.push([res.countryCode + res.vatNumber, res.valid ? 'yes' : 'no', "\"" + res.name + "\"", "\"" + (res.address.replace('\n', '\\n')) + "\"\n"].join(','));
      }
      encodedUri = encodeURI(l.join(''));
      s = ['<p style="margin-top: 2em">', '<a href="' + encodedUri + '" download="vat-results.csv">Download as CSV</a>', '<table class="pure-table pure-table-horizontal" style="margin-top: 1em">', '<thead><tr><td>VAT No</td><td>Valid</td><td>Company</td>', '<td>Address</td></thead><tbody>'];
      for (k = 0, len2 = results.length; k < len2; k++) {
        res = results[k];
        s.push("<tr><td>" + res.countryCode + res.vatNumber + "</td>");
        s.push("<td>" + (res.valid ? 'yes' : 'no') + "</td>");
        s.push("<td>" + res.name + "</td><td>" + res.address + "</td></tr>");
      }
      s.push('<tbody></table>');
      if (invalid_code > 0) {
        s.push("<p>The country code is invalid on " + invalid_code + " of the VAT numbers.");
        s.push("<br>Valid country codes are: " + (country_codes.join(', ')));
      }
      showResult(s.join(''));
      $('html,body').animate({
        scrollTop: Math.max($('#result').offset().top - 35, 0)
      });
      toggleSubmit();
    };
    retry = 0;
    iter = function(vatno, fake) {
      var val;
      if (!vatno) {
        val = checklist.shift();
        if (val != null) {
          vatno = val[0], fake = val[1];
        }
      }
      if (!vatno) {
        createTable();
        return;
      }
      if (fake) {
        results.push({
          countryCode: '',
          vatNumber: vatno,
          valid: false,
          name: '',
          address: ''
        });
        iter();
        return;
      }
      showResult("<p>Checking " + vatno + " (" + (vatnos.length - checklist.length) + " of " + vatnos.length + ")");
      return viesRequest(vatno, function(err, res) {
        if (err) {
          if (err.includes('blocked')) {
            showResult("<p>Sorry, but <strong>access to VIES is currently blocked</strong>. Contact admins at: TAXUD-VIESWEB@ec.europa.eu");
            toggleSubmit();
          }
          else if (retry < 4) {
            retry += 1;
            setTimeout((function() {
              return iter(vatno, fake);
            }), (retry + 1) * 1000);
            showResult("<p>There is a problem communicating with VIES. Retry attempt " + retry + ". Be patient!");
          } else {
            showResult("<p>Sorry, but <strong>VIES appears to be down</strong>. (The error code is '" + err + "'.)");
            toggleSubmit();
          }
        } else {
          results.push(res);
          setTimeout(iter, 1000);
        }
      });
    };
    toggleSubmit();
    iter();
  };

  $(document).ready(function() {
    $('#vatform').submit(function(e) {
      e.preventDefault();
      checkVat($('#vatno').val());
    });
    $('#batchvatform').submit(function(e) {
      var v;
      e.preventDefault();
      batchCheck((function() {
        var i, len, ref, results1;
        ref = $('#vatnos').val().split('\n');
        results1 = [];
        for (i = 0, len = ref.length; i < len; i++) {
          v = ref[i];
          if (v.length > 0) {
            results1.push(v);
          }
        }
        return results1;
      })());
    });
  });

}).call(this);
