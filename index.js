var flock = require('flockos');
var config = require('./config.js');
var express = require('express');
var docusign = require('./docusign.js');
var sendLease = require('./sendLease.js');
var xmlparser = require('express-xml-bodyparser');
var fs = require('fs');

flock.setAppId(config.appId);
flock.setAppSecret(config.appSecret);

var app = express();

// Listen for events on /events, and verify event tokens using the token verifier.
app.use(flock.events.tokenVerifier);
app.post('/events', flock.events.listener);
app.post('/notification', xmlparser({trim: false, explicitArray: false}), notifier);

// Read tokens from a local file, if possible.
var tokens;
try {
    tokens = require('./tokens.json');
} catch (e) {
    tokens = {};
}

// save tokens on app.install
flock.events.on('app.install', function (event) {
    tokens[event.userId] = event.token;
});

// delete tokens on app.uninstall
flock.events.on('app.uninstall', function (event) {
    delete tokens[event.userId];
});

flock.events.on('client.slashCommand', function (event) {
    var token;
    var user;
    user = event.userId;
    email = event.text;
    token = config.bottoken;

    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    validEmail = re.test(email);
    if (validEmail) {
        flock.chat.sendMessage(token, {
            to: user,
            text: 'Sending lease to ' + email,
        }, function (error, response) {
            if (error)
                console.log('error: ', error);
            else
                console.log(response);
        })

        sendLease.sendLease(email);

        flock.chat.sendMessage(token, {
            to: user,
            text: 'Lease has been sent',
        }, function (error, response) {
            if (error)
                console.log('error: ', error);
            else
                console.log(response);
        })
    } else {
        flock.chat.sendMessage(token, {
            to: user,
            text: 'Email was not valid. Please try again.',
        }, function (error, response) {
            if (error)
                console.log('error: ', error);
            else
                console.log(response);
        })
    }
});

flock.events.on('chat.receiveMessage', function (event) {
    var uploadedPDF;
    var user;
    var message;
    var token;

    user = event.userId;
    token = config.bottoken;

    uploadedPDF = event.message.attachments[0].downloads[0].src;

    if (uploadedPDF) {
        console.log(uploadedPDF);
        message = 'PDF received!';
    } else {
        message = 'Please try again';
    }
    flock.chat.sendMessage(token, {
        to: user,
        text: message,
    }, function (error, response) {
        if (error)
            console.log('error: ', error);
        else
            console.log(response);
    })
});

function notifier(req, res, next) {

  console.log(JSON.stringify(req.body,null,2)); // converted using xml2js

  var envelopeId = req.body.docusignenvelopeinformation.envelopestatus.envelopeid;
  var filename = [envelopeId,'xml'].join('.');

  var token = config.bottoken;

  flock.chat.sendMessage(token, {
      to: 'u:qtx4yhgtxsyetths',
      text: 'Lease was signed',
  }, function (error, response) {
      if (error)
          console.log('error: ', error);
      else
          console.log(response);
  })

  // Logs for your EventNotification webhooks are visible from Admin -> Connect (left menu, under Integrations) -> Logs (button in the top-right)
  // https://admindemo.docusign.com/connect-logs
  res.send('DocuSign webhook endpoint reached!');
}

// Start the listener after reading the port from config
var port = config.port || 8080;
app.listen(port, function () {
    console.log('Listening on port: ' + port);
});

// exit handling -- save tokens in token.js before leaving
process.on('SIGINT', process.exit);
process.on('SIGTERM', process.exit);
process.on('exit', function () {
    fs.writeFileSync('./tokens.json', JSON.stringify(tokens));
});
