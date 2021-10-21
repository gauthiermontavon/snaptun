var instance, server = {
  start: function (configObject) {

    var express = require('express'),
      cors = require('cors'),
      app = express(),
      loki = require('lokijs'),
      //lfsa2 = require('loki-indexed-adapter'),
      lfsa = require('lokijs/src/loki-fs-structured-adapter'),
      bodyParser = require('body-parser'),
      defaultOptions = {
        port: 20800
      },
      config = configObject || defaultOptions,
      file = config.file || 'loki.json',
      adapter = new lfsa();
      db = new loki(file, {
        adapter:adapter,
        autoload: true,
        autosave:true
      }),
      fs = require('fs'),
      routes = require('./routes')(db);

    function tryDbLoad(db) {
      if (fs.existsSync(file)) {
        try {
          db.loadDatabase();
        } catch (err) {
          console.log('No existing file to load from.');
        }
      }
    }

    function setRoute(route) {
      app.all(route.url, function (req, res, next) {
        res.set('Content-Type', 'application/json');
        next();
      });
      console.log('registering ' + route.url + '[' + route.method + ']');
      app[route.method](route.url, route.handler);
    }

    const options = {
      origin: 'http://localhost:4200',
    }
    app.use(cors(options));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
      extended: true
    }));

    app.engine('jade', require('jade').__express);
    app.set('view engine', 'jade');
    app.set('views', __dirname + '/html');
    app.use(express.static(__dirname + '/html/js'));
    app.use(express.static(__dirname + '/html/css'));
    routes.forEach(setRoute);
    app.get('/stop', function (req, res) {
      res.send('Snaptun LokiJS server stopped');
      server.stop();

    });

    instance = app.listen(config.port, function () {
      console.log('Listening to ' + config.port);
    });
  },
  stop: function () {
    instance.close();
    console.log('Server stopped');
    process.exit(0);
  }
};


//tryDbLoad(db);



module.exports = server;
