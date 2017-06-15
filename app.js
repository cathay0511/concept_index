const Koa = require('koa');

const bodyParser = require('koa-bodyparser');

const controller = require('./controller');

const templating = require('./templating');

const rest = require('./rest');

const app = new Koa();

const isProduction = process.env.NODE_ENV === 'production';

app.keys = ['some secret hurr'];

// authentication
const session = require('koa-session');
app.use(session({}, app))

// require('./utils/auth')
const passport = require('./utils/auth')
app.use(passport.initialize())
app.use(passport.session())



// log request URL:
app.use(async (ctx, next) => {
    console.log(`Process ${ctx.request.method} ${ctx.request.url}...`);
    var
        start = new Date().getTime(),
        execTime;
    await next();
    execTime = new Date().getTime() - start;
    ctx.response.set('X-Response-Time', `${execTime}ms`);
});

// static file support:
let staticFiles = require('./static-files');
app.use(staticFiles('/static/', __dirname + '/static'));

// parse request body:
app.use(bodyParser());

// add nunjucks as view:
app.use(templating('views', {
    noCache: !isProduction,
    watch: !isProduction
}));

// bind .rest() for ctx:
app.use(rest.restify());

// add controller:
app.use(controller());

app.listen(3000);
console.log('app started at port 3000...');
