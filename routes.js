function generateRoutes(db) {
  "use strict";
  var util = require('util'),
    $utils = {
      sendError: function (status, res, message) {
        res.status(status).json({
          message: message
        });
      },
      parseParams: function (params, config) {
        var prop, parsed = {};
        for (prop in params) {
          switch (config[prop]) {
          case 'int':
            parsed[prop] = parseInt(params[prop], 10);
            break;
          case 'float':
            parsed[prop] = parseFloat(params[prop]);
            break;
          case 'bool':
            parsed[prop] = params[prop] === 'true' ? true : false;
            break;
          case 'string':
            parsed[prop] = '' + params[prop];
            break;
          default:
            // bypass
            parsed[prop] = params[prop];
          }
        }
        return parsed;
      },
      defer: process.nextTick,
      checkParams: function (obj, res, paramsArray) {
        var passed = true;
        paramsArray.forEach(function (param) {
          if (!obj[param]) {
            $utils.sendError(400, res, 'missing ' + param + ' parameter');
            passed = false;
          }
        });
        return passed;
      },
      checkCollection: function (name, res) {
        var collection = db.getCollection(name);
        if (!collection) {
          $utils.sendError(400, res, 'Collection ' + name + ' not found');
          return null;
        }
        return collection;
      },
      mergeDocument: function (src, dst, collection) {
        var prop;
        if (src.$loki === dst.$loki) {
          for (prop in src) {
            if (prop !== 'meta') {
              dst[prop] = src[prop];
            }
          }
          collection.update(dst);
        }
      }
    };

  function getCollectionName(coll) {
    return coll.name;
  }
  var jade = require('jade');

  return [{
    method: 'get',
    url: '/',
    handler: function (req, res) {
      res.set('Content-Type', 'text/html');

      res.render(__dirname + '/html/index.jade', {
        pageTitle: "Snaptun - LokiJS Server"
      });
    }
  }, {
    method: 'get',
    url: '/listcollections',
    handler: function (req, res) {
      res.json(db.listCollections());
    }
  }, {
    method: 'post',
    url: '/addcollection',
    handler: function (req, res) {
      console.log(req.body)
      if (!req.body.name) {
        $utils.sendError(400, res, 'missing collection name parameter');
        return;
      }
      if (!req.body.options) {
        req.body.options = {};
      }
      var options = {
        indices: req.body.options.indices || [],
        transactional: req.body.options.transactional || false,
        asyncListeners: req.body.options.asyncListeners || false,
        clone: req.body.options.clone || false,
        disableChangesApi: req.body.options.disableChangesApi || false
      };
      var coll = db.addCollection(req.body.name, options);
      if (!coll) {
        $utils.sendError(500, res, 'Collection ' + req.body.name + ' not created');
      } else {
        res.json({
          message: 'Collection ' + req.body.name + ' created successfully',
          config: {
            'name': coll.name,
            'transactional': coll.transactional,
            'asyncListeners': coll.asyncListeners,
            'cloneObjects': coll.cloneObjects,
            'disableChangesApi': coll.disableChangesApi
          }
        });
      }
    }
  }, {
    method: 'post',
    url: '/changes/:collection/:flush?',
    handler: function (req, res) {
      if (coll = $utils.checkCollection(req.params.collection, res)) {
        var flush = req.params.flush || false;
        if (flush) {
          var changes = db.generateChangesNotification([coll.name]);
          $utils.defer(coll.flushChanges);
          res.json(changes);
        } else {
          res.json(db.generateChangesNotification([coll.name]));
        }
      }
    }
  }, {
    method: 'put',
    url: '/insert',
    handler: function (req, res) {
      if (!req.body.doc || !req.body.collection) {
        $utils.sendError(400, res, 'missing document or collection parameter');
        return;
      }
      var doc = db.getCollection(req.body.collection).insert(req.body.doc);
      db.saveDatabase();
      res.json({
        'message': 'Document inserted',
        'doc': doc
      });
      return;
    }
  }, {
    method: 'post',
    url: '/update',
    handler: function (req, res) {
      var coll, doc;
      if ($utils.checkParams(req.body, res, ['collection', 'doc'])) {
        if (coll = $utils.checkCollection(req.body.collection, res)) {
          doc = coll.get(req.body.doc.$loki);
          if (!doc) {
            $utils.sendError(400, res, 'Document with $loki id ' + req.body.doc.$loki + ' does not exist');
            return;
          }
          $utils.mergeDocument(req.body.doc, doc, coll);
          res.json({

          });
        }
      }
    }
  },
  {
    method: 'post',
    url: '/upsert',
    handler: function (req, res) {
      var coll, doc;
      if ($utils.checkParams(req.body, res, ['collection', 'doc'])) {
        if (coll = $utils.checkCollection(req.body.collection, res)) {
          if(!req.body.doc.$loki){
          //doc = coll.get(req.body.doc.$loki);
          //if (!doc) {
            doc = db.getCollection(req.body.collection).insert(req.body.doc);
            db.saveDatabase();
            res.json({
             'message': 'Document inserted',
             'doc': doc
            });
            return;
          }else{
            doc = coll.get(req.body.doc.$loki);
            $utils.mergeDocument(req.body.doc, doc, coll);
            res.json({
              'message': 'Document updated',
              'doc': doc
            });
          }
        }
      }
    }
  },
   {
    url: '/get/:collection/:id?',
    method: 'get',
    handler: function (req, res) {
      var params = $utils.parseParams(req.params, {
          collection: 'string',
          id: 'int'
        }),
        coll,
        collection,
        id;

      coll = params.collection;
      if (!$utils.checkCollection(coll, res)) {
        return;
      }

      collection = db.getCollection(coll);

      if (req.params.id) {
        id = parseInt(params.id, 10);
        res.json(collection.get(id));
      } else {
        res.json(collection.find());
      }
    }
  }, {
    url: '/get/:collection/byhash/:md5',
    method: 'get',
    handler: function (req, res) {
      var params = $utils.parseParams(req.params, {
          collection: 'string',
          hash: 'string'
        }),
        coll,
        collection,
        hash;

      coll = params.collection;
      if (!$utils.checkCollection(coll, res)) {
        return;
      }

      collection = db.getCollection(coll);

      if (req.params.md5) {
        console.log('findOne by hhash:'+req.params.md5);
        res.json(collection.findOne({md5:req.params.md5}));
        //hash = parseInt(params.hash, 10);
        //res.json(collection.get(hash));
      }
      /*else {
        res.json(collection.find());
      }*/
    }
  }, {
    url: '/delete/:collection/:id',
    method: 'delete',
    handler: function (req, res) {
      var coll, params, doc;
      if (coll = $utils.checkCollection(req.params.collection, res)) {
        params = $utils.parseParams(req.params, {
          id: 'int'
        });
        doc = coll.get(params.id);
        coll.remove(doc);
        res.json({
          message: 'Document with $loki id ' + req.params.id + ' deleted'
        });
      }
    }
  }, {
    url: '/deleteview/:collection/:viewname',
    method: 'delete',
    handler: function (req, res) {
      var coll;
      if (coll = $utils.checkCollection(req.params.collection, res)) {
        coll.removeDynamicView(req.params.viewname);
        res.json({
          message: 'View ' + req.params.viewname + ' deleted from ' + req.params.collection
        });
      }
    }
  }, {
    url: '/addview',
    method: 'post',
    handler: function (req, res) {
      var approvedParameters,
        params,
        coll,
        view,
        filter;

      approvedParameters = $utils.checkParams(req.body, res, ['collection', 'name', 'where']);
      if (!approvedParameters) {
        return;
      }

      params = $utils.parseParams(req.body, {
        collection: 'string',
        name: 'string',
        sort: 'string'
      });

      coll = $utils.checkCollection(params.collection, res);
      if (!coll) {
        return;
      }

      view = coll.addDynamicView(params.name);

      // if view created successfully
      if (view) {
        filter = Function.apply(null, params.where);

        view.applyWhere(filter);
        res.json({
          message: 'DynamicView ' + params.name + ' created successfully'
        });
      } else {
        $utils.sendError(500, res, 'Server error, dynamic view not created');
      }

    }
  }, {
    url: '/view/:collection/:viewname',
    method: 'get',
    handler: function (req, res) {
      var coll, view;
      if (coll = $utils.checkCollection(req.params.collection, res)) {
        view = coll.getDynamicView(req.params.viewname);
        if (view) {
          res.json(view.data());
        } else {
          $utils.sendError(400, res, 'Trying to retrieve a non-existent view');
        }
      }
      return;
    }
  }, {
    url: '/memusage',
    method: 'get',
    handler: function (req, res) {
      res.json(process.memoryUsage());
    }
  }];
}

module.exports = generateRoutes;
