###
https://github.com/nephics/euvat-direct
Copyright 2015 Nephics AB, Jacob Söndergaard
MIT License
### 

viesRequest = (vatno, callback) ->
  ### Check an EU VAT number with VIES

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
  ###
  
  # you need a CORS proxy to reach VIES from the browser
  # your proxy shall forward POST requests to "http://ec.europa.eu/taxation_customs/vies/services/checkVatService"
  # this URL is for demo purposes only:
  cors_proxy_url = 'http://cors-proxy.nephics.com/vies'

  xmlRequest = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<SOAP-ENV:Envelope xmlns:ns0="urn:ec.europa.eu:taxud:vies:services:checkVat:types" ',
    'xmlns:ns1="http://schemas.xmlsoap.org/soap/envelope/" ',
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ',
    'xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">',
    '<SOAP-ENV:Header/><ns1:Body><ns0:checkVat>',
    '<ns0:countryCode>', vatno[...2].toUpperCase(), '</ns0:countryCode><ns0:vatNumber>',
    vatno[2..], '</ns0:vatNumber></ns0:checkVat></ns1:Body></SOAP-ENV:Envelope>'].join('')

  $.ajax
    url: cors_proxy_url
    data: xmlRequest
    method: 'POST'
    dataType: 'xml'
    success: (xmlDoc) ->
      xml = $(xmlDoc)
      if xml.find('checkVatResponse').length is 0
        callback 'invalid'
        return
      result = {}
      for tag in ['countryCode', 'vatNumber', 'requestDate', 'valid',
                  'name', 'address']
        el = xml.find(tag)
        if tag is 'requestDate'
          result[tag] = el.text()[...10]
        else if tag is 'valid'
          result[tag] = el.text() is 'true'
        else
          result[tag] = el.text()

      callback null, result
      return
    error: (xhr, status, error) ->
      callback status
      return
  return


country_codes = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL',
                 'ES', 'FI', 'FR', 'GB', 'HR', 'HU', 'IE', 'IT', 'LT',
                 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI',
                 'SK']


showResult = (html) ->
  $('#result').html(html)


toggleSubmit = ->
  b = $('button[type=submit]')

  b.prop('disabled', not b.prop('disabled'))

checkVat = (vatno) ->
  # some simple error checking before sending the request to VIES
  if not vatno
    showResult '<p><strong>No VAT number specified.</strong>'
    return
  if vatno.length < 7 or vatno.length > 20
    showResult '<p><strong>This is not a VAT number.</strong>'
    return
  if vatno[...2].toUpperCase() not in country_codes
    showResult "<p>#{vatno[...2]} is not one of the valid country 
                codes: #{country_codes.join(', ')}"
    return
  showResult('<p>Checking...')
  toggleSubmit()
  viesRequest vatno, (err, res) ->
    if err
      showResult "<p>Sorry, but VIES appears to be down. (The error code is '#{err}'.)"
    else
      showResult [
        "<p>The VAT number #{if res.valid then '<strong>is' else 'is <strong>not'} valid.</strong>",
        '<p>The full VAT response:', '<pre>', JSON.stringify res, null,
        '  ', '</pre>'
      ].join '\n'
    toggleSubmit()
    return
  return


batchCheck = (vatnos) ->
  # some simple error checking before sending the request to VIES
  if vatnos.length == 0
    showResult "<p><strong>You didn't provide any VAT numbers to check!</strong>"
    return
  checklist = []
  invalid_code = 0
  for vatno in vatnos
    fake = false
    if vatno.length < 7 or vatno.length > 20
      fake = true
    else if vatno[...2].toUpperCase() not in country_codes
      invalid_code += 1
      fake = true
    checklist.push [vatno, fake]

  results = []

  createTable = ->
    l = ['data:text/csv;charset=utf-8,', 'vatno,valid,company,address\n']
    for res in results
       l.push [res.countryCode + res.vatNumber,
               if res.valid then 'yes' else 'no',
               "\"#{res.name}\"", "\"#{res.address.replace('\n', '\\n')}\"\n"].join(',')
    encodedUri = encodeURI(l.join(''))

    s = ['<p style="margin-top: 2em">',
         '<a href="' + encodedUri + '" download="vat-results.csv">Download as CSV</a>',
         '<table class="pure-table pure-table-horizontal" style="margin-top: 1em">',
         '<thead><tr><td>VAT No</td><td>Valid</td><td>Company</td>',
         '<td>Address</td></thead><tbody>']
    for res in results
      s.push "<tr><td>#{res.countryCode}#{res.vatNumber}</td>"
      s.push "<td>#{if res.valid then 'yes' else 'no'}</td>"
      s.push "<td>#{res.name}</td><td>#{res.address}</td></tr>"
    s.push '<tbody></table>'

    if invalid_code > 0
      s.push "<p>The country code is invalid on #{invalid_code} of the VAT numbers."
      s.push "<br>Valid country codes are: #{country_codes.join(', ')}"
    showResult(s.join(''))

    $('html,body').animate {scrollTop: Math.max($('#result').offset().top - 35, 0)}

    toggleSubmit()
    return

  retry = 0

  iter = (vatno, fake) ->
    if not vatno
      val = checklist.shift()
      if val?
        [vatno, fake] = val

    if not vatno
      createTable()
      return

    if fake
      results.push
        countryCode: ''
        vatNumber: vatno
        valid: false
        name: ''
        address: ''
      iter()
      return

    showResult("<p>Checking #{vatno} (#{vatnos.length - checklist.length} of #{vatnos.length})")

    viesRequest vatno, (err, res) ->
      if err
        if retry < 4
          retry += 1
          setTimeout (-> iter(vatno, fake)), (retry + 1) * 1000
          showResult "<p>There is a problem communicating with VIES. Retry attempt #{retry}. Be patient!"
        else
          showResult "<p>Sorry, but <strong>VIES appears to be down</strong>. (The error code is '#{err}'.)"
          toggleSubmit()
      else
        results.push(res)
        iter()
      return

  toggleSubmit()
  iter()
  return


$(document).ready ->
  $('#vatform').submit (e) ->
    e.preventDefault()
    checkVat $('#vatno').val()
    return
  $('#batchvatform').submit (e) ->
    e.preventDefault()
    batchCheck (v for v in $('#vatnos').val().split('\n') when v.length > 0)
    return
  return
