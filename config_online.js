// exec NODE_ENV=production /usr/local/bin/node /where/yourprogram.js >> /var/log/node.log 2>&1

var config = {
    database: 'concept_index_online',
    username: 'www',
    password: 'www',
    host: '182.92.1.178',
    port: 3306
};

module.exports = config;
