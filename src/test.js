// var _ = require('lodash')
// var path = require('path')
// console.log(_.map(['lib/lucene-core-6.6.0.jar', 'lib/lucene-queryparser-6.6.0.jar', 'lib/lucene-sandbox-6.6.0.jar',
//     'lib/lucene-queries-6.6.0.jar',
//     'lib/lucene-analyzers-common-6.6.0.jar', 'lib/commons-io-2.5.jar', 'lib/hamcrest-core-1.3.jar', 'lib/junit-4.12.jar', 'bin'], d => {
// }) .join(';'));

require('find-java-home')(function(err, home){
    if(err)return console.log(err);
    console.log(home);
});