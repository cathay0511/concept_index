const Sequelize = require('sequelize');
var moment = require('moment');
const passport = require('../utils/auth');

const ERROR_MSG_NOT_LOGIN = 'not login';
const ERROR_MSG_NO_CEPT_AUTH = 'no cept auth';

const CEPT_OP_TYPE_READ = 1;
const CEPT_OP_TYPE_UPDATE = 2;

const isProduction = process.env.NODE_ENV === 'production';
const config = isProduction ? require('../config_online') : require('../config');
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
console.log(moment().local().format(DATE_FORMAT));

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

var ConceptModel = sequelize.define('concept', {
    id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true   // in order to get the new created record's id after ConceptModel.create done
    },
    name: Sequelize.STRING(64),
    description: Sequelize.TEXT,
    user_id: Sequelize.BIGINT,
    is_public: Sequelize.BIGINT(2),
    valid: Sequelize.BIGINT(2),
    created: Sequelize.DATE
}, {
    freezeTableName: true, // 默认false修改表名为复数，true不修改表名，与数据库表名同步
    tableName: 'concept',
    timestamps: false
});

var ConceptContextModel = sequelize.define('concept_context', {
    id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    cid: Sequelize.BIGINT,
    context_concept_id: Sequelize.BIGINT
}, {
    freezeTableName: true, // 默认false修改表名为复数，true不修改表名，与数据库表名同步
    tableName: 'concept_context',
    timestamps: false
});

async function verifyCeptOpAuth(cid, uid, opType = 0) {
    var cept = await getConceptDetail(cid);
    if (cept) {
        switch(opType) {
            case CEPT_OP_TYPE_READ:
                if (cept.user_id === uid || cept.is_public) {
                    return true;
                }
                break;
            case CEPT_OP_TYPE_UPDATE:
                if (cept.user_id === uid) {
                    return true;
                }
                break;
            default:
                return false;
                break;
        }
    }

    return false;
}

// cidDist && uid 都是注入的辅助变量
async function getConceptContext(cid, cidDist, uid = 0) {
    let ret = [];

    var conceptContexts = await ConceptContextModel.findAll({
        where: {
            cid: cid
        }
    });

    if (conceptContexts && conceptContexts.length > 0) {
        for (let i = 0; i < conceptContexts.length; i++) {
            let item = conceptContexts[i];

            var verifyResult = await verifyCeptOpAuth(item.context_concept_id, uid, CEPT_OP_TYPE_READ);
            if (!verifyResult) {
                item.dirty = true;
                cidDist[item.context_concept_id] = -1;  // dirty
                ret.push(item);
                continue;
            }

            ret.push(item);
            if (!cidDist[item.context_concept_id]) {
                cidDist[item.context_concept_id] = 1;
                let subRet = await getConceptContext(item.context_concept_id, cidDist, uid);
                ret = ret.concat(subRet);
            }
        }
    }
    return ret;
}

async function getConceptDetail(cid) {
    let ret = {};

    var concept = await ConceptModel.findOne({
        where: {
            valid: 1,
            id: cid
        }
    });

    if (concept) {
        var user = await UserModel.findOne({
            where: {
                id: concept.user_id
            }
        });

        ret = {
            id: concept.id,
            name: concept.name,
            is_public: concept.is_public,
            user_id: concept.user_id,
            user_name: user.name,
            description: concept.description,
            created: concept.created,
            updated: concept.updated
        }
    }
    return ret;
}

module.exports = {
    'GET /api/getAllCept/ownerType/:ownerType': async (ctx, next) => {
        var user = ctx.state.user;
        var userId = user ? user.id : 0;
        var ownerType = ctx.params.ownerType;

        var cnd = {
            'valid': 1
        };
        if (ownerType === 'ALL') {
            cnd['$or'] = [ {'user_id': userId}, {'is_public': 1} ];
        } else if (ownerType === 'SELF_PRIVATE') {
            cnd['user_id'] = userId;
            cnd['is_public'] = 0;
        } else if (ownerType === 'SELF_PUBLIC') {
            cnd['user_id'] = userId;
            cnd['is_public'] = 1;
        } else if (ownerType === 'PUBLIC') {
            cnd['user_id'] = {ne: userId};
            cnd['is_public'] = 1;
        }

        var ret = await ConceptModel.findAll({
            'where': cnd
        });
        ctx.rest(ret);
    },

    'GET /api/getAllCept/ownerType/:ownerType/query/:query': async (ctx, next) => {
        var user = ctx.state.user;
        var userId = user ? user.id : 0;
        var query = ctx.params.query;
        var ownerType = ctx.params.ownerType;

        var cnd = {
            'valid': 1,
            'name': {
                '$like': '%' + query + '%'
            }
        };
        if (ownerType === 'ALL') {
            cnd['$or'] = [ {'user_id': userId}, {'is_public': 1} ];
        } else if (ownerType === 'SELF_PRIVATE') {
            cnd['user_id'] = userId;
            cnd['is_public'] = 0;
        } else if (ownerType === 'SELF_PUBLIC') {
            cnd['user_id'] = userId;
            cnd['is_public'] = 1;
        } else if (ownerType === 'PUBLIC') {
            cnd['user_id'] = {ne: userId};
            cnd['is_public'] = 1;
        }

        var ret = await ConceptModel.findAll({
            'where': cnd
        });
        ctx.rest(ret);
    },

    'GET /api/getCeptById/:id': async (ctx, next) => {
        var user = ctx.state.user;
        var userId = user ? user.id : 0;
        var cid = parseInt(ctx.params.id);

        var verifyResult = await verifyCeptOpAuth(cid, userId, CEPT_OP_TYPE_READ);
        if (!verifyResult) {
            ctx.rest({status: 0, msg: ERROR_MSG_NO_CEPT_AUTH});
            return;
        }

        var ret = {
            detail: null,
            ctx: null,
            ctxInfoList: {}
        };
        var ceptDetail = await getConceptDetail(cid);
        if (ceptDetail) {
            ret.detail = ceptDetail;
            var cidDist = {};
            cidDist[cid] = 1;
            ret.ctx = await getConceptContext(cid, cidDist, userId);
            for (var key in cidDist) {
                item = {
                    id: key
                }

                var cd = await getConceptDetail(key);
                if (cd) {
                    item.name = cd.name;
                    item.user_id = cd.user_id;
                    item.is_public = cd.is_public;
                }

                if (cidDist[key] === -1) {
                    item.dirty = true;
                }
                ret.ctxInfoList[key] = item;
            }
        }
        ctx.rest(ret);
    },

    'GET /api/getCeptByQuery/query/:query': async (ctx, next) => {
        var user = ctx.state.user;
        var userId = user ? user.id : 0;

        var query = ctx.params.query;
        var ret = await ConceptModel.findOne({
            where: {
                'valid': 1,
                'name': query,
                '$or': [
                    {'user_id': userId},
                    {'is_public': 1}
                ]
            }
        });
        ctx.rest(ret);
    },

    'GET /api/getCeptDetailById/:id': async (ctx, next) => {
        var cid = parseInt(ctx.params.id);
        var ret = await getConceptDetail(cid);
        ctx.rest(ret);
    },

    'POST /api/createCept': async (ctx, next) => {
        if (!ctx.isAuthenticated()) {
            ctx.rest({status: 0, msg: ERROR_MSG_NOT_LOGIN});
            return;
        }

        var user = ctx.state.user;
        var name = ctx.request.body.name;
        var description = ctx.request.body.description;
        var isPublic = parseInt(ctx.request.body.is_public);
        var currentDate = moment().local().format(DATE_FORMAT);
        var ret = await ConceptModel.create({
            name: name,
            description: description,
            user_id: parseInt(user.id),
            is_public: isPublic,
            created: currentDate
        });

        ctx.rest(ret);
    },

    'POST /api/updateCept': async (ctx, next) => {
        if (!ctx.isAuthenticated()) {
            ctx.rest({status: 0, msg: ERROR_MSG_NOT_LOGIN});
            return;
        }

        var user = ctx.state.user;
        var cid = parseInt(ctx.request.body.cid);

        var verifyResult = await verifyCeptOpAuth(cid, user.id, CEPT_OP_TYPE_UPDATE);
        if (!verifyResult) {
            ctx.rest({status: 0, msg: ERROR_MSG_NO_CEPT_AUTH});
            return;
        }

        var description = ctx.request.body.description;
        var isPublic = parseInt(ctx.request.body.is_public);
        var ret = await ConceptModel.update({
            description: description,
            is_public: isPublic
        }, {
            where: {
                id: cid
            }
        });

        ctx.rest({status: 1, data: ret});
    },

    'POST /api/removeCept': async (ctx, next) => {
        if (!ctx.isAuthenticated()) {
            ctx.rest({status: 0, msg: ERROR_MSG_NOT_LOGIN});
            return;
        }

        var user = ctx.state.user;
        var cid = parseInt(ctx.request.body.cid);

        var verifyResult = await verifyCeptOpAuth(cid, user.id, CEPT_OP_TYPE_UPDATE);
        if (!verifyResult) {
            ctx.rest({status: 0, msg: ERROR_MSG_NO_CEPT_AUTH});
            return;
        }

        var ret = await ConceptModel.update({
            valid: 0
        }, {
            where: {
                id: cid
            }
        });

        ctx.rest({status: 1, data: ret});
    },

    'POST /api/addCtx': async (ctx, next) => {
        if (!ctx.isAuthenticated()) {
            ctx.rest({status: 0, msg: ERROR_MSG_NOT_LOGIN});
            return;
        }

        var ret = {};
        var user = ctx.state.user;
        var cid = parseInt(ctx.request.body.cid);

        var verifyResult = await verifyCeptOpAuth(cid, user.id, CEPT_OP_TYPE_UPDATE);
        if (!verifyResult) {
            ctx.rest({status: 0, msg: ERROR_MSG_NO_CEPT_AUTH});
            return;
        }

        var name = ctx.request.body.name;
        var cept = await ConceptModel.findOne({
            where: {
                id: cid
            }
        });
        var ceptCtx = await ConceptModel.findOne({
            where: {
                name: name
            }
        });

        if (!ceptCtx) {
            var currentDate = moment().local().format(DATE_FORMAT);
            var ceptCtx = await ConceptModel.create({
                name: name,
                user_id: user.id,
                created: currentDate
            });
        }
        
        if (cept && ceptCtx) {
            var verifyResult = await verifyCeptOpAuth(ceptCtx.id, user.id, CEPT_OP_TYPE_READ);
            if (!verifyResult) {
                ctx.rest({status: 0, msg: ERROR_MSG_NO_CEPT_AUTH});
                return;
            }

            ret = await ConceptContextModel.create({
                cid: cid,
                context_concept_id: ceptCtx.id
            });
        }
        ctx.rest({status: 1, data: ret});
    },

    'POST /api/removeCtx': async (ctx, next) => {
        if (!ctx.isAuthenticated()) {
            ctx.rest({status: 0, msg: ERROR_MSG_NOT_LOGIN});
            return;
        }

        var user = ctx.state.user;
        var cid = parseInt(ctx.request.body.cid);

        var verifyResult = await verifyCeptOpAuth(cid, user.id, CEPT_OP_TYPE_UPDATE);
        if (!verifyResult) {
            ctx.rest({status: 0, msg: ERROR_MSG_NO_CEPT_AUTH});
            return;
        }

        var ret = ConceptContextModel.destroy({
            where: {
                cid: cid,
                context_concept_id: parseInt(ctx.request.body.ccid)
            }
        });
        ctx.rest(ret);
    },


    // login
    'POST /api/login': async (ctx, next) => {
        return passport.authenticate('local', function(err, user, info, status) {
            if (user === false) {
                ctx.redirect('/login');
            } else {
                ctx.login(user);
                ctx.redirect('/index');
            }
        })(ctx, next);
    },

    'GET /api/logout': async (ctx, next) => {
        ctx.logout();
        ctx.redirect('/index');
    },

    'GET /api/userInfo': async (ctx, next) => {
        ctx.rest(ctx.state.user);
        // ctx.rest({status: ctx.isAuthenticated()});
    }
};
