// 参考文献
// https://github.com/rkusa/koa-passport-example
// http://www.jianshu.com/p/7010bea0c656

const passport = require('koa-passport')
const LocalStrategy = require('passport-local').Strategy

const crypto = require('crypto');

const Sequelize = require('sequelize');
const isProduction = process.env.NODE_ENV === 'production';
const config = isProduction ? require('../config_online') : require('../config');

var sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 30000
    }
});

var UserModel = sequelize.define('user', {
    id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true   // in order to get the new created record's id after ConceptModel.create done
    },
    name: Sequelize.STRING(64),
    pwd: Sequelize.STRING(128),
    email: Sequelize.STRING(64)
}, {
    freezeTableName: true, // 默认false修改表名为复数，true不修改表名，与数据库表名同步
    tableName: 'user',
    timestamps: false
});

const secret = 'void';
//加密
function encrypt(str, secret) {
    var cipher = crypto.createCipher('aes192', secret);
    var enc = cipher.update(str, 'utf8', 'hex');
    enc += cipher.final('hex');
    return enc;
}
//解密
function decrypt(str, secret) {
    var decipher = crypto.createDecipher('aes192', secret);
    var dec = decipher.update(str, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
}

// serializeUser 在用户登录验证成功以后将会把用户的数据存储到 session 中
passport.serializeUser(function (user, done) {
    done(null, user)
})

// deserializeUser 在每次请求的时候将从 session 中读取用户对象
passport.deserializeUser(function (user, done) {
    return done(null, user)
})

// 用户名密码验证策略
passport.use(new LocalStrategy(
    /**
     * @param username 用户输入的用户名
     * @param password 用户输入的密码
     * @param done 验证验证完成后的回调函数，由passport调用
     */
    function (username, password, done) {
        let where = { where: { name: username } }
        UserModel.findOne(where).then(function (result) {
            if (result != null) {
                if (result.pwd == password) {
                    return done(null, result)
                } else {
                    return done(null, false, '密码错误')
                }
            } else {
                return done(null, false, '未知用户')
            }
        }).catch(function (err) {
            log.error(err.message)
            return done(null, false, { message: err.message })
        })
    }
))


module.exports = passport;
