const Sequelize = require('sequelize');
const isProduction = process.env.NODE_ENV === 'production';
const config = isProduction ? require('../config_online') : require('../config');

const passport = require('../utils/auth');

console.log('init sequelize...');

var sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 30000
    }
});

var ConceptModel = sequelize.define('concept', {
    id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true   // in order to get the new created record's id after ConceptModel.create done
    },
    name: Sequelize.STRING(64),
    description: Sequelize.TEXT
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

async function getConceptContext(cid, cidDist) {
    let ret = [];

    var conceptContexts = await ConceptContextModel.findAll({
        where: {
            cid: cid
        }
    });

    if (conceptContexts && conceptContexts.length > 0) {
        for (let i = 0; i < conceptContexts.length; i++) {
            let item = conceptContexts[i];
            ret.push(item);
            if (!cidDist[item.context_concept_id]) {
                cidDist[item.context_concept_id] = 1;
                let subRet = await getConceptContext(item.context_concept_id, cidDist);
                ret = ret.concat(subRet);
            }
        }
    }
    return ret;
}

async function getConceptDetail(cid) {
    let ret = [];

    var concept = await ConceptModel.findOne({
        where: {
            id: cid
        }
    });

    return concept;
}

async function getConceptDetailByQuery(query) {
    let ret = [];

    var concept = await ConceptModel.findOne({
        where: {
            name: query
        }
    });

    return concept;
}

module.exports = {
    'GET /api/getAllCept': async (ctx, next) => {
        var ret = await ConceptModel.findAll();
        ctx.rest(ret);
    },

    'GET /api/getCeptById/:id': async (ctx, next) => {
        var cid = parseInt(ctx.params.id);
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
            ret.ctx = await getConceptContext(cid, cidDist);
            for (var key in cidDist) {
                var cd = await getConceptDetail(key);
                ret.ctxInfoList[key] = cd.name;
            }
        }
        ctx.rest(ret);
    },

    'GET /api/getCeptByQuery/query/:query': async (ctx, next) => {
        var query = ctx.params.query;
        var ret = await getConceptDetailByQuery(query);
        ctx.rest(ret);
    },

    'GET /api/getCeptDetailById/:id': async (ctx, next) => {
        var cid = parseInt(ctx.params.id);
        var ret = await getConceptDetail(cid);
        ctx.rest(ret);
    },

    'POST /api/createCept': async (ctx, next) => {
        var name = ctx.request.body.name;
        var description = ctx.request.body.description;
        var ret = await ConceptModel.create({
            name: name,
            description: description
        });

        ctx.rest(ret);
    },

    'POST /api/updateCept': async (ctx, next) => {
        var cid = parseInt(ctx.request.body.cid);
        var description = ctx.request.body.description;
        var ret = await ConceptModel.update({
            description: description
        }, {
            where: {
                id: cid
            }
        });

        ctx.rest(ret);
    },

    'POST /api/addCtx': async (ctx, next) => {
        var ret = {};
        var cid = parseInt(ctx.request.body.cid);
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

        if (cept && ceptCtx) {
            ret = await ConceptContextModel.create({
                cid: cid,
                context_concept_id: ceptCtx.id
            });
        }
        ctx.rest(ret);
    },

    'POST /api/removeCtx': async (ctx, next) => {
        var ret = ConceptContextModel.destroy({
            where: {
                cid: parseInt(ctx.request.body.cid),
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
    }
};
