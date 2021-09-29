(function (root, $) {

  var state = {
    collections: [],
    currentCollection: null,
    data: []
  };

  function streamMaker() {
    var registeredListeners = [];
    return {
      observe: function (callback) {
        registeredListeners.push(callback)
      },
      update: function (value) {
        registeredListeners.forEach(function (cb) {
          cb(value);
        })
      }
    };
  }

  var history = streamMaker();
  history.observe(pplCollList);
  
  var displayDetailCollections = function (collname){
	console.log('dispplay:'+collname);
	var main = $('#main');
    //main.empty();
	$.getJSON('/get/'+collname,function(data){
		
		console.log(JSON.stringify(data));
		// using JSON.stringify pretty print capability:
		var str = JSON.stringify(data, undefined, 4);

		// display pretty printed object in text area:
		document.getElementById('jsontext').innerHTML = str;

	});
  }

  function pplCollList(state) {

    var list = $('#collections');

	var ref = displayDetailCollections;
    list.empty();
    state.collections.forEach(function (o) {
		//console.log('one'+displayDetailCollections);
		var li = document.createElement('li');
		console.log('two');
		li.addEventListener('click',function(){ref(o.name)} );
		console.log('three');
		//li.addEventListener('click',function(){alert('kikou')});
		//li.onclick = ref(o.name);
		var txt = document.createTextNode(o.name + '[' + o.count + ']--'); 
		li.append(txt);
		list.append(li);
	
     //list.append($('<li onclick="displayDetailCollections('+o.name+')"></li>').text(o.name + '[' + o.count + ']'));
    });
  }

  function copy(obj) {
    if (Array.isArray(obj)) {
      return JSON.parse(JSON.stringify(obj));
    }

    var ret = {};
    Object.keys(obj).forEach(function (prop) {
      ret[prop] = copy(obj[prop]);
    });
    return ret;
  }

  function pushToStream(state) {
    return function (data) {
      console.log('Data received, pushing to stream...');
      var newstate = copy(state);
      newstate.collections = data;
	  console.log(JSON.stringify(data));
      history.update(newstate);
      return newstate;
    };
  }

  var setColls = pushToStream(history);

  function getStats() {
    $.getJSON('/listcollections', setColls);
  }

  function createColl(name, options, callback) {
    $.post('/addcollection', {
      name: name,
      options: options
    }, callback);
  }
  


  getStats();

  function initUI() {
    $('#newcoll').blur(function () {
      createColl($('#newcoll').val(), {}, getStats);
    })
  }

  initUI();

})(window, $);