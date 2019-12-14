/* [참고/사용한 소스들] 
 * https://www.sqlitetutorial.net/sqlite-nodejs/connect/
 * https://stackoverflow.com/questions/24042697/node-js-routes-adding-route-handlers-to-an-already-instantiated-http-server#24176311
 * https://stackabuse.com/a-sqlite-tutorial-with-node-js/
 * https://stackoverflow.com/questions/14528385/how-to-convert-json-object-to-javascript-array
*/

function print(prpt) {
	console.log(prpt); // 베이직언어같은데에 있는 출력문 함수
}

const sqlite3 = require('sqlite3').verbose(); // 설정

// DB 열기
var db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
	print("문제가 발생했습니다.\r\n");
    console.error(err.message);
  }
  console.log('DB 열기 완료.');
});

function sqlexec(command, param = 0) { // SQL명령 실행
	var args = param; 
	if(param == 0) args = []; // 매게변수 없으면 빈 배열로..
	db.run(command, args, (err) => {
	    if(err) {
	    	console.log('DB 오류! ', err);
	    }
	});
}

var sqldata = []; // SQL SELECT 명령 실행후 SQL안의 데이타(파이썬같은에서 conn.cursor().fetchall같은거)

function sqlget(command, param = 0) { // SQL명령 실행(select문전용)
    let args = param;
	if(param == 0) args = [];
	db.all(command, args, (err, result) => {
		if(err) {
			console.log(err);
			return null;
		} else {
			//console.log(result);
			/*
			var retval = [];
			for(var i=0; i<result.length; i++) {
				jdata = result[i];
				var arrres = [];
				for(var j in result[i])
					arrres.push([j, jdata[j]]);
				retval[i] = arrres[0];
			}*/
			//console.log(retval);
			//if(retval == []) retval = null;
			sqldata = result;
			return result;
		}
	});
}

var express = require('express'); // 모듈 불러오기(아마)
var wiki = express(); // 익스프레스 호출

var request = require('request');

var swig = require('swig'); // swig 불러오기(아마도)

swig.setFilter('encode_userdoc', function(input) {
	return encodeURI('사용자:' + input);
});

swig.setFilter('to_date', function(input) {
	return input;
});

swig.setFilter('localdate', function(input, fmt = 'Y-m-d H:i:s') {
	var date = input.split(' ')[0];
	var time = input.split(' ')[1];
	return '<time datetime="' + date + 'T' + time + '.000Z" data-format="' + fmt + '">' + input + '</time>';
});

function not(v) {
	if(v.length == 0) return true;
	else return false;
}

function getSkin() { // 사용중인 스킨
	sqlget("select data from wiki where dataname = ?", ['default_skin']);
	try {
		return sqldata[0]['data'];
	} catch(e) {
		return 'raw';
	}
}

class clsSkinInfo {
	constructor(title, viewname = null, subtitle = null) {
		this.title = title;
		this.viewName = viewname;
		this.subtitle = subtitle;
	}
}

class clsDocument {
	constructor(title, namespace = '문서') {
		this.title = title;
		this.namespace = namespace;
		this.fulltitle = namespace + ':' + title;
	}
}

function getConfig(name, def) {
	sqlget("select data from wiki where dataname = ?", ['wiki.' + name]);
	if(not(sqldata)) {
		return def;
	} else {
		return sqldata[0]['data'];
	}
}
var _ = undefined; // 함수 인자에서 중간 인자만 넣고싶을 때 f(_, _, 'abc') 이런식
function render(title = '', content = '', varlist = {}, noskin = false, viewname = null, subtitle = null) { // 스킨 레이아웃을 불러와서 지정한 제목, 내용으로 렌더링
	var skinInfo = new clsSkinInfo(title, viewname, subtitle);
	try {
		var template = swig.compileFile('./views/skins/' + getSkin() + '/views/default.html');
	} catch(e) {
		return `
			<title>` + title + ` (프론트엔드 오류!)</title>
			<meta charset=utf-8>` + content;
	}
	var output;
	var templateVariables = varlist;
	templateVariables['skinInfo'] = skinInfo;
	if(noskin) {
		output = content;
	} else {
		output = template(templateVariables);
	}
	
	var header = '<html><head>';
	var config = require("./views/skins/" + getSkin() + "/config.json");
	header += `
		<meta charset="utf-8">
		<meta http-equiv="x-ua-compatible" content="ie=edge">
		<meta http-equiv="x-pjax-version" content="">
		<meta name="generator" content="the seed">
		<meta name="application-name" content="` + getConfig('site_name', 'Wiki') + `">
		<meta name="mobile-web-app-capable" content="yes">
		<meta name="msapplication-tooltip" content="` + getConfig('site_name', 'Wiki') + `">
		<meta name="msapplication-starturl" content="/w/` + encodeURI(getConfig('frontpage', 'FrontPage')) + `">
		<link rel="search" type="application/opensearchdescription+xml" title="` + getConfig('site_name', 'Wiki') + `" href="/opensearch.xml">
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
		<link rel="stylesheet" href="/css/diffview.css">
		<link rel="stylesheet" href="/css/katex.min.css">
		<link rel="stylesheet" href="/css/wiki.css">
	`;
	for(var i=0; i<config["auto_css_targets"]['*'].length; i++) {
		header += '<link rel=stylesheet href="' + config["auto_css_targets"]['*'][i] + '">';
	}
	header += `
	<!--[if (!IE)|(gt IE 8)]><!--><script type="text/javascript" src="/js/jquery-2.1.4.min.js"></script><!--<![endif]-->
	<!--[if lt IE 9]><script type="text/javascript" src="/js/jquery-1.11.3.min.js"></script><![endif]-->
	<script type="text/javascript" src="/js/dateformatter.js?508d6dd4"></script>
	<script type="text/javascript" src="/js/intersection-observer.js?36e469ff"></script>
	<script type="text/javascript" src="/js/theseed.js?24141115"></script>
	`;
	for(var i=0; i<config["auto_js_targets"]['*'].length; i++) {
		header += '<script type="text/javascript" src="' + config["auto_js_targets"]['*'][i]['path'] + '"></script>';
	}
	
	header += config['additional_heads'];
	header += '</head><body class="';
	for(var i=0; i<config['body_classes'].length; i++) {
		header += config['body_classes'][i] + ' ';
	}
	header += '">';
	var footer = '</body></html>';
	return header + output + footer;
}

wiki.get('/skins/:skinname/:filepath*', function(req, res) {
	var skinname = request.params.skinname;
	var filepath = request.params.filepath;
	res.sendFile('./views/skins/' + skinname + '/static/' + filepath);
});

wiki.get('/js/:filepath', function(req, res) {
	var filepath = request.params.filepath;
	res.sendFile('./views/js/' + filepath);
});

wiki.get('/css/:filepath', function(req, res) {
	var filepath = request.params.filepath;
	res.sendFile('./views/css/' + filepath);
});

wiki.get('/', function(req, res) {
    //res.send('안녕! 위키 접속은 <a href="/w/">/w/</a>로...');
	res.redirect('/w/'); // 리다이렉트
});

wiki.get('/w/', function(req, res) { // 대문으로..
    sqlget("select data from wiki where dataname = ?", ['frontpage']);
	if(not(sqldata)) {
		sqlexec("insert into wiki (dataname, data) values ('frontpage', 'FrontPage')");
		res.redirect('/w/FrontPage');
	} else {
		res.redirect('/w/' + encodeURI(sqldata[0]['data']));
	}
});

function processTitle(fulltitle) {
	var namespaces = [];
	var title = fulltitle.replace(fulltitle.split(':')[0] + ':', '');
	var namespace = fulltitle.split(':')[0];
	if(fulltitle.split(':')[0] == fulltitle) {
		namespace = '문서';
	}
	sqlget("select namespace from namespaces");
	for(var i=0; i<sqldata.length; i++) {
		namespaces[i] = sqldata[i]['namespace'];
	}
	if(namespace in namespaces) {
		return [namespace, title];
	} else {
		if(namespace == getConfig('site_name')) {
			namespace = 'wiki';
		} else {
			namespace = '문서';
		}
	}
	
	return [namespace, title];
};

function namumark(content) {
	// 작성 예정
	return content;
}

wiki.get('/w/:title*', function(req, res) {
	var fulltitle = req.param("title");
	var viewname = 'wiki';
	var namespace = processTitle(fulltitle)[0];
	var title = processTitle(fulltitle)[1];
	var content = '';
	var error = null;
	var httpstat = 200;
	
	sqlget("select content from documents where title = ? and namespace = ?", [title, namespace]);
	if(not(sqldata)) {
		content = `
		<p>
			해당 문서를 찾을 수 없습니다.
		</p>
		<p>
			<a rel="nofollow" href="/edit/` + encodeURI(fulltitle) + `">[새 문서 만들기]</a>
		</p>
		`;
		viewname = 'notfound';
		error = true;
		httpstat = 404;
	} else {
		content = namumark(sqldata[0]['content']);
	}
	
	res.status(httpstat).send(render(title, content, {
		document: new clsDocument(title, namespace),
		error: error
	}, _, _, viewname));
});

wiki.use(function(req, res, next) {
    return res.status(404).send(`<html><head><meta charset="utf-8"><meta name="viewport" content="width=1240"><title>Page is not found!</title><style>section {	position: fixed;	top: 0;	right: 0;	bottom: 0;	left: 0;	padding: 80px 0 0;	background-color:#EFEFEF;	font-family: "Open Sans", sans-serif;	text-align: center;}h1 {	margin: 0 0 19px;	font-size: 40px;	font-weight: normal;	color: #E02B2B;	line-height: 40px;}p {margin: 0 0 57px;	font-size: 16px;	color:#444;	line-height: 23px;}</style></head><body><section><h1>404</h1><p>Page is not found!<br><a href="/">Back to home</a></p></section></body></html>`);
});

var port = 0;
if(process.argv[3] == undefined) { // 매개변수로 포트 확인. 없으면 80
	port = 80;
} else {
	port = Number(process.argv[3]);
}
var server = wiki.listen(port); // 서버실행
print("127.0.0.1:" + String(port) + "에 실행 중. . .");
